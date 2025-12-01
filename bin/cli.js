#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Adjust path to point to the built server
const serverPath = path.join(__dirname, '../build/index.js');

const USER_CWD = process.cwd();
const PORT = 4567; // Standard Port
const SESSION_ID = randomUUID();

// --- Argument Parsing ---
const args = process.argv.slice(2);
const isDebug = args.includes('--debug') || args.includes('-d');
const isAuto = args.includes('--auto') || args.includes('-a');

// Flags are ONLY active if Auto Mode is enabled
const isVault = isAuto && (args.includes('--vault') || args.includes('--global') || args.includes('-v'));
const isHidden = isAuto && (args.includes('--ignore') || args.includes('-i'));
const isSingleFile = isAuto && (args.includes('--single') || args.includes('-s'));

// Custom Path Parsing (Allowed in both modes)
let customPath = null;
const customFlagIndex = args.indexOf('--custom') > -1 ? args.indexOf('--custom') : args.indexOf('-c');
if (customFlagIndex > -1 && args[customFlagIndex + 1]) {
    customPath = args[customFlagIndex + 1];
    customPath = customPath.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

// --------------------------------

if (!isAuto) {
    console.log('\x1b[36m%s\x1b[0m', '› Initializing TXT-Forge...');
    // In UI mode, flags are ignored, so we don't log them.
} else {
    console.log('\x1b[36m%s\x1b[0m', '› TXT-Forge Auto-Mode Initiated...');
    // Removed [Ignored: VISIBLE] as requested. Only showing active overrides.
    const activeOptions = [];
    if (isVault) activeOptions.push('Vault Save');
    if (isHidden) activeOptions.push('Hide Ignored');
    if (isSingleFile) activeOptions.push('Single File');

    if (activeOptions.length > 0) {
        console.log('\x1b[90m%s\x1b[0m', `  Overrides: [${activeOptions.join(', ')}]`);
    }
}

if (isDebug) console.log('\x1b[33m%s\x1b[0m', '› Debug Mode Enabled');

async function killPort(port) {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        // FIX: On Windows, strictly filter for 'LISTENING' to avoid killing the browser (ESTABLISHED connections)
        const command = isWin
            ? `netstat -ano | findstr :${port} | findstr LISTENING`
            : `lsof -i :${port} -t`;

        exec(command, (err, stdout) => {
            if (!stdout) return resolve();
            console.log('\x1b[90m%s\x1b[0m', '› Preparing local network environment...');

            if (isWin) {
                const lines = stdout.trim().split('\n');
                // It's possible multiple lines exist, kill the PID found in the first valid listener
                const pid = lines[0].trim().split(/\s+/).pop();
                if (pid && pid !== '0') {
                    exec(`taskkill /PID ${pid} /F`, () => setTimeout(resolve, 500)); // Increased buffer to 500ms
                } else {
                    resolve();
                }
            } else {
                const pid = stdout.trim();
                if (pid) {
                    exec(`kill -9 ${pid}`, () => setTimeout(resolve, 500)); // Increased buffer to 500ms
                } else {
                    resolve();
                }
            }
        });
    });
}

async function startServer() {
    await killPort(PORT);

    // In auto mode, we pipe stdout to 'ignore' unless debug
    const stdioConfig = (isAuto && !isDebug) ? ['ignore', 'ignore', 'inherit'] : 'inherit';

    const server = spawn('node', [serverPath], {
        env: {
            ...process.env,
            PORT: PORT.toString(),
            TXT_FORGE_CWD: USER_CWD,
            ORIGIN: `http://localhost:${PORT}`,
            FORGE_SESSION_ID: SESSION_ID,
            node_env: 'production',
            TXT_FORGE_DEBUG: isDebug ? 'true' : 'false'
            // REMOVED TXT_FORGE_SINGLE from env. 
            // We now pass strict control flags via the API body for auto mode.
            // UI mode ignores them completely.
        },
        stdio: stdioConfig
    });

    // FIX: Detect if server crashes immediately (e.g., EADDRINUSE)
    let serverExited = false;
    server.on('exit', (code) => {
        serverExited = true;
        if (code !== 0 && code !== null) {
            console.error('\x1b[31m%s\x1b[0m', `✕ Server failed to start (Exit Code: ${code}). Port might be locked.`);
            process.exit(code);
        }
    });

    const url = `http://localhost:${PORT}`;

    // Wait for server to start
    setTimeout(async () => {
        // FIX: Don't open browser if server died
        if (serverExited) return;

        if (isAuto) {
            // --- AUTO MODE LOGIC ---
            try {
                console.log('\x1b[90m%s\x1b[0m', '› Detecting stack and processing files...');
                const response = await fetch(`${url}/api/cli-forge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        saveToVault: isVault,
                        hideIgnoredInTree: isHidden,
                        isSingleFile: isSingleFile, // Pass the flag here
                        customPath: customPath
                    })
                });
                const result = await response.json();
                if (result.success) {
                    console.log('\x1b[32m%s\x1b[0m', '✓ Auto-Forge Complete!');
                    if (result.gitIgnoreModified) {
                        console.log('\x1b[33m%s\x1b[0m', '⚠ Note: Added "TXT-Forge/" to your .gitignore file.');
                    }
                    if (result.configWasReset) {
                        console.log('\x1b[33m%s\x1b[0m', '⚠ Warning: Project config reset due to version update.');
                    }
                    if (result.updateInfo && result.updateInfo.isUpdateAvailable) {
                        console.log('\x1b[35m%s\x1b[0m', `➜ Update Available: ${result.updateInfo.latest} (Current: ${result.updateInfo.current})`);
                        console.log('\x1b[90m%s\x1b[0m', '  Run "npm install -g txt-forge" to update.');
                    }
                    console.log('\x1b[90m%s\x1b[0m', `  Detected: ${result.detectedIds.join(', ') || 'None'}`);
                    console.log('\x1b[36m%s\x1b[0m', `  Output:   ${result.outputPath}`);
                    console.log('\x1b[90m%s\x1b[0m', `  Generated ${result.files.length} file(s).`);
                    try {
                        await open(result.outputPath);
                    } catch (openErr) { }
                } else {
                    console.error('\x1b[31m%s\x1b[0m', '✕ Error:', result.message);
                }
            } catch (e) {
                console.error('\x1b[31m%s\x1b[0m', '✕ Failed to communicate with internal server.');
                if (isDebug) console.error(e);
            } finally {
                setTimeout(() => {
                    server.kill();
                    process.exit(0);
                }, 500);
            }
        } else {
            // --- UI MODE LOGIC ---
            console.log('\x1b[32m%s\x1b[0m', `✓ Ready. Opening browser...`);
            console.log('\x1b[90m%s\x1b[0m', '  (Press Ctrl+C to exit manually)');
            await open(url);
        }
    }, 1500); // Cold start delay

    process.on('SIGINT', () => {
        server.kill();
        process.exit();
    });
}

startServer();
