import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Resolve package.json to get the Source of Truth version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../../../package.json');
let APP_VERSION = '0.0.0';
try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    APP_VERSION = pkg.version;
} catch (e) { console.error("Could not read app version"); }

const CONFIG_DIR = path.join(os.homedir(), '.txt-forge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PROJECTS_FILE = path.join(CONFIG_DIR, 'projects.json'); // <--- NEW

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error("Failed to load config", e);
    }
    return { lastCustomPath: null };
}

export function saveConfig(data) {
    try {
        const current = loadConfig();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...data }, null, 2));
    } catch (e) {
        console.error("Failed to save config", e);
    }
}

// --- NEW FUNCTIONS ---

export function loadProjectConfig(projectPath) {
    try {
        if (fs.existsSync(PROJECTS_FILE)) {
            const content = fs.readFileSync(PROJECTS_FILE, 'utf-8');
            if (!content.trim()) return { config: null, wasReset: false }; // Handle empty file case
            
            const data = JSON.parse(content);
            const normalizedPath = path.resolve(projectPath);
            const entry = data[normalizedPath];

            if (entry) {
                // Version Check
                if (entry.appVersion !== APP_VERSION) {
                    // Mismatch: Erase this specific config
                    delete data[normalizedPath];
                    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
                    // Return special object to signal reset
                    return { config: null, wasReset: true, oldVersion: entry.appVersion };
                }
                return { config: entry, wasReset: false };
            }
        }
    } catch (e) {
        console.error("Failed to load project config", e);
    }
    return { config: null, wasReset: false };
}

export function saveProjectConfig(projectPath, config) {
    try {
        let data = {};
        if (fs.existsSync(PROJECTS_FILE)) {
            data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
        }
        const normalizedPath = path.resolve(projectPath);

        // Issue #2 Fix: Explicitly replace the key with the new config object.
        // This ensures no stale properties remain if the user changed structure.
        data[normalizedPath] = {
            ...config,
            appVersion: APP_VERSION, // Save current version
            lastUpdated: new Date().toISOString()
        };

        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to save project config", e);
    }
}

// ---------------------

export async function pickDirectory() {
    const platform = os.platform();
    let command = '';
    let args = [];

    if (platform === 'win32') {
        // PowerShell hack: Use OpenFileDialog with 'Select Folder' as filename to force modern UI
        command = 'powershell';
        args = [
            '-NoProfile',
            '-Command',
            `
            Add-Type -AssemblyName System.Windows.Forms
            $f = New-Object System.Windows.Forms.OpenFileDialog
            $f.ValidateNames = $false
            $f.CheckFileExists = $false
            $f.CheckPathExists = $true
            $f.FileName = "Select Folder"
            $f.Title = "Select Output Folder"
            $f.Filter = "Folders|no.files"
            if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Host ([System.IO.Path]::GetDirectoryName($f.FileName))
            }
            `
        ];
    } else if (platform === 'darwin') {
        // AppleScript to choose folder
        command = 'osascript';
        args = ['-e', 'POSIX path of (choose folder)'];
    } else if (platform === 'linux') {
        // Zenity
        command = 'zenity';
        args = ['--file-selection', '--directory'];
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            // Ensure we get a clean string
            const result = stdout.trim();
            if (code === 0 && result && result !== "Select Folder") {
                 // The PowerShell hack sometimes returns the filename appended, ensure we return the directory
                 // But the script above explicitly prints GetDirectoryName, so result is correct.
                resolve(result);
            } else {
                resolve(null);
            }
        });
    });
}
