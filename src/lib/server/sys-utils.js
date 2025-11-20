import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.txt-forge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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

export async function pickDirectory() {
    const platform = os.platform();
    let command = '';
    let args = [];

    if (platform === 'win32') {
        // PowerShell script to open FolderBrowserDialog
        command = 'powershell';
        args = [
            '-NoProfile',
            '-Command',
            "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath"
        ];
    } else if (platform === 'darwin') {
        // AppleScript to choose folder
        command = 'osascript';
        args = ['-e', 'POSIX path of (choose folder)'];
    } else if (platform === 'linux') {
        // Zenity or KDialog
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
            if (code === 0 && stdout.trim()) {
                resolve(stdout.trim());
            } else {
                resolve(null); // User cancelled or error
            }
        });
    });
}
