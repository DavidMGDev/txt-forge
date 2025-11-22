import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';
import net from 'net'; // <--- NEW: For port checking

// Resolve package.json to get the Source of Truth version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../../../package.json');
let APP_VERSION = '0.0.0';
try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    APP_VERSION = pkg.version;
} catch (e) { console.error("Could not read app version"); }

export { APP_VERSION };

// --- DYNAMIC CWD MANAGEMENT ---
let CURRENT_WORKING_DIR = process.env.TXT_FORGE_CWD || process.cwd();

export function getCwd() {
    return CURRENT_WORKING_DIR;
}

export function setCwd(newPath) {
    if (fs.existsSync(newPath)) {
        CURRENT_WORKING_DIR = path.resolve(newPath);
        return true;
    }
    return false;
}
// ------------------------------

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

// --- UPDATE UTILS ---

export async function checkForUpdate() {
    return new Promise((resolve) => {
        const req = https.get('https://registry.npmjs.org/txt-forge/latest', {
            headers: { 'User-Agent': 'txt-forge-cli' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const latest = json.version;
                    resolve({
                        current: APP_VERSION,
                        latest: latest,
                        isUpdateAvailable: latest !== APP_VERSION
                    });
                } catch (e) { resolve(null); }
            });
        });
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(null);
        });
        req.on('error', () => resolve(null));
    });
}

export async function performGlobalUpdate() {
    return new Promise((resolve, reject) => {
        const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        // Attempt to install globally. note: on Linux/Mac this might fail without sudo,
        // but we can try.
        exec(`${cmd} install -g txt-forge@latest`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Update error: ${error}`);
                reject(error);
                return;
            }
            resolve(true);
        });
    });
}

// --- MULTI-INSTANCE LAUNCHER ---

export async function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close((err) => {
                if (err) reject(err);
                else resolve(port);
            });
        });
        srv.on('error', (err) => reject(err));
    });
}

export async function launchNewInstance(targetPath) {
    // 1. Find a free port so we don't kill the current session
    const port = await getFreePort();
    
    // 2. Resolve path to bin/cli.js
    // Since we are in src/lib/server/sys-utils.js (dev) or build/server/chunks/sys-utils.js (prod),
    // we need a reliable way to find the bin.
    // In production 'npm install -g', the bin is usually alongside the build.
    // Strategy: Walk up until we find package.json, then assume bin/cli.js is there.
    
    let rootDir = __dirname;
    let cliPath = '';
    
    // Simple walk up 4 levels (covers src/lib/server and build/chunks/...)
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(rootDir, 'package.json'))) {
            cliPath = path.join(rootDir, 'bin', 'cli.js');
            break;
        }
        rootDir = path.dirname(rootDir);
    }

    if (!cliPath || !fs.existsSync(cliPath)) {
        throw new Error('Could not locate CLI entry point.');
    }

    // 3. Spawn the new process DETACHED
    // We spawn 'node' pointing to cli.js
    const child = spawn(process.execPath, [cliPath], {
        detached: true,
        stdio: 'ignore',
        cwd: targetPath, // <--- Important: Run in the new folder
        env: {
            ...process.env,
            PORT: port.toString(), // Pass the new port
            TXT_FORGE_CWD: targetPath // Explicitly set CWD env override
        }
    });

    child.unref(); // Allow parent to stop waiting for this child
    return port;
}

export async function restartApp(targetPath = null) {
    const cwd = targetPath || getCwd();
    
    // 1. Find CLI Path (Reusing logic from launchNewInstance)
    let rootDir = __dirname;
    let cliPath = '';
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(rootDir, 'package.json'))) {
            cliPath = path.join(rootDir, 'bin', 'cli.js');
            break;
        }
        rootDir = path.dirname(rootDir);
    }

    if (!cliPath || !fs.existsSync(cliPath)) {
        throw new Error('Could not locate CLI entry point.');
    }

    // 2. Spawn the new process inheriting the current terminal
    // This makes it take over the current CMD/PowerShell window
    const child = spawn(process.execPath, [cliPath], {
        detached: false, 
        stdio: 'inherit', // <--- Key: Take over the TTY
        cwd: cwd,
        env: {
            ...process.env,
            // Ensure we don't carry over the old port if it was set, allow CLI to pick default or random
            PORT: undefined, 
            TXT_FORGE_CWD: cwd 
        }
    });

    // 3. Exit the current process gracefully to let the new one take over
    child.on('spawn', () => {
        setTimeout(() => process.exit(0), 100); // Small delay to ensure handoff
    });
}
