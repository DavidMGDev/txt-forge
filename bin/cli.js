#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '../build/index.js');

// Initial Configuration
let currentCwd = process.cwd();
// Allow environment variable to override port, else default 4567
let currentPort = process.env.PORT ? parseInt(process.env.PORT) : 4567;
const SESSION_ID = randomUUID();

// --- Argument Parsing ---
const args = process.argv.slice(2);
const isDebug = args.includes('--debug') || args.includes('-d');
const isAuto = args.includes('--auto') || args.includes('-a');
const isVault = args.includes('--vault') || args.includes('--global') || args.includes('-v');
const isHidden = args.includes('--ignore') || args.includes('-i');

// Custom Path Parsing
const customFlagIndex = args.indexOf('--custom') > -1 ? args.indexOf('--custom') : args.indexOf('-c');
if (customFlagIndex > -1 && args[customFlagIndex + 1]) {
    let p = args[customFlagIndex + 1];
    p = p.replace(/^"|"$/g, '').replace(/^'|'$/g, ''); // Clean quotes
    currentCwd = path.resolve(p);
}

// --------------------------------

if (isAuto) {
    // --- AUTO MODE HANDLER (One-shot, no restart logic needed) ---
    runAutoMode();
} else {
    // --- UI MODE (PERSISTENT MANAGER) ---
    runManagerLoop();
}

async function runManagerLoop() {
    let activeChild = null;
    let shouldRestart = true;
    let isFirstRun = true;

    // Initial Welcome
    console.log('\x1b[36m%s\x1b[0m', '› Initializing TXT-Forge Manager...');

    while (shouldRestart) {
        try {
            await new Promise((resolve, reject) => {
                // 1. Kill port before spawning (ensure clean state)
                killPort(currentPort).then(() => {
                    
                    // 2. Spawn the SvelteKit Server
                    // stdio: 'inherit' lets it share the console
                    // 'ipc' allows process.send() to work from the child
                    activeChild = spawn('node', [serverPath], {
                        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                        env: {
                            ...process.env,
                            PORT: currentPort.toString(),
                            TXT_FORGE_CWD: currentCwd,
                            ORIGIN: `http://localhost:${currentPort}`,
                            FORGE_SESSION_ID: SESSION_ID,
                            TXT_FORGE_DEBUG: isDebug ? 'true' : 'false'
                        }
                    });

                    if(!isDebug) {
                        console.log('\x1b[32m%s\x1b[0m', `✓ TXT-Forge Active in: ${currentCwd}`);
                        console.log('\x1b[90m%s\x1b[0m', `  http://localhost:${currentPort}`);
                    }

                    // Open Browser (only on first run)
                    if (isFirstRun) {
                        setTimeout(() => {
                            open(`http://localhost:${currentPort}`).catch(() => {});
                        }, 1000);
                        isFirstRun = false;
                    }

                    // 3. Listen for IPC Messages from the Child
                    activeChild.on('message', (msg) => {
                        if (msg.type === 'RESTART') {
                            console.log('\x1b[33m%s\x1b[0m', '\n↻ Restarting TXT-Forge...');
                            if (msg.path) {
                                currentCwd = path.resolve(msg.path); // Update Directory
                                console.log('\x1b[90m%s\x1b[0m', `› Switching to: ${currentCwd}`);
                            }
                            shouldRestart = true;
                            activeChild.kill(); // Kill child to trigger 'exit' listener
                        } else if (msg.type === 'SHUTDOWN') {
                            shouldRestart = false;
                            activeChild.kill();
                        }
                    });

                    // 4. Handle Child Exit
                    activeChild.on('exit', (code) => {
                        if (shouldRestart) {
                            resolve(null); // Resolve promise to loop again
                        } else {
                            console.log('\x1b[90m%s\x1b[0m', '› Session Ended.');
                            process.exit(0); // Exit manager completely
                        }
                    });
                });
            });
        } catch (e) {
            console.error("Manager Error:", e);
            process.exit(1);
        }
    }
}

// --- AUTO MODE HANDLER ---
async function runAutoMode() {
    await killPort(currentPort);

    // In auto mode, we pipe stdout to 'ignore' to keep the CLI output clean from server logs
    // unless we are in debug mode.
    const stdioConfig = (isAuto && !isDebug) ? ['ignore', 'ignore', 'inherit'] : 'inherit';
    const server = spawn('node', [serverPath], {
        env: {
            ...process.env,
            PORT: currentPort.toString(),
            TXT_FORGE_CWD: currentCwd,
            ORIGIN: `http://localhost:${currentPort}`,
            FORGE_SESSION_ID: SESSION_ID,
            node_env: 'production',
            TXT_FORGE_DEBUG: isDebug ? 'true' : 'false'
        },
        stdio: stdioConfig
    });
    const url = `http://localhost:${currentPort}`;
    
    // Wait for server to start
    setTimeout(async () => {
        try {
            console.log('\x1b[90m%s\x1b[0m', '› Detecting stack and processing files...');

            // 1. Call the CLI-specific API endpoint
            const response = await fetch(`${url}/api/cli-forge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    saveToVault: isVault,
                    hideIgnoredInTree: isHidden,
                    customPath: customPath
                })
            });
            const result = await response.json();

            if (result.success) {
                console.log('\x1b[32m%s\x1b[0m', '✓ Auto-Forge Complete!');

                // 1. Gitignore Warning
                if (result.gitIgnoreModified) {
                    console.log('\x1b[33m%s\x1b[0m', '⚠ Note: Added "TXT-Forge/" to your .gitignore file.');
                }

                // 2. Config Reset Warning
                if (result.configWasReset) {
                    console.log('\x1b[33m%s\x1b[0m', '⚠ Warning: Your project configuration was reset due to a version update.');
                }

                // 3. Update Available Warning
                if (result.updateInfo && result.updateInfo.isUpdateAvailable) {
                     console.log('\x1b[35m%s\x1b[0m', `➜ Update Available: ${result.updateInfo.latest} (Current: ${result.updateInfo.current})`);
                     console.log('\x1b[90m%s\x1b[0m', '  Run "npm install -g txt-forge" to update.');
                }

                console.log('\x1b[90m%s\x1b[0m', `  Detected: ${result.detectedIds.join(', ') || 'None'}`);
                console.log('\x1b[36m%s\x1b[0m', `  Output:   ${result.outputPath}`);
                console.log('\x1b[90m%s\x1b[0m', `  Generated ${result.files.length} file(s).`);

                // Open the folder automatically
                try {
                    await open(result.outputPath);
                } catch (openErr) {
                    console.error('\x1b[33m%s\x1b[0m', '⚠ Could not auto-open folder (Permissions/OS restriction).');
                }

            } else {
                console.error('\x1b[31m%s\x1b[0m', '✕ Error:', result.message);
                if (result.ids) console.log('  Detected:', result.ids.join(', '));
            }
        } catch (e) {
            console.error('\x1b[31m%s\x1b[0m', '✕ Failed to communicate with internal server.');
            if (isDebug) console.error(e);
        } finally {
            // Cleanup and Exit
            setTimeout(() => {
                server.kill();
                process.exit(0);
            }, 500);
        }
    }, 1500); // Wait for SvelteKit cold start

    process.on('SIGINT', () => {
        server.kill();
        process.exit();
    });
}

// --- UTILS ---
async function killPort(port) {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const command = isWin
            ? `netstat -ano | findstr :${port}`
            : `lsof -i :${port} -t`;
        exec(command, (err, stdout) => {
            if (!stdout) return resolve();
            
            if (isDebug) console.log('› Cleaning port...');
            
            if (isWin) {
                 const lines = stdout.trim().split('\n');
                 const pid = lines[0].trim().split(/\s+/).pop();
                 if(pid && pid !== '0') exec(`taskkill /PID ${pid} /F`, () => setTimeout(resolve, 200));
                 else resolve();
            } else {
                const pid = stdout.trim();
                if(pid) exec(`kill -9 ${pid}`, () => setTimeout(resolve, 200));
                else resolve();
            }
        });
    });
}
