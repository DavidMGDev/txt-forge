import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

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
            const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
            // Normalize path to ensure consistency
            const normalizedPath = path.resolve(projectPath);
            return data[normalizedPath] || null;
        }
    } catch (e) {
        console.error("Failed to load project config", e);
    }
    return null;
}

export function saveProjectConfig(projectPath, config) {
    try {
        let data = {};
        if (fs.existsSync(PROJECTS_FILE)) {
            data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
        }
        const normalizedPath = path.resolve(projectPath);
        data[normalizedPath] = config;
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
