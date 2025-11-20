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
const PORT = 4567;
const SESSION_ID = randomUUID();

// --- Argument Parsing ---

const args = process.argv.slice(2);

const isDebug = args.includes('--debug') || args.includes('-d');

// Auto Mode Flags
const isAuto = args.includes('--auto') || args.includes('-a');
const isVault = args.includes('--vault') || args.includes('--global') || args.includes('-v');
// CHANGED: -i now means "Hide Ignored" (isHidden)
const isHidden = args.includes('--ignore') || args.includes('-i');

// Custom Path Parsing (-c "path" or --custom "path")
let customPath = null;
const customFlagIndex = args.indexOf('--custom') > -1 ? args.indexOf('--custom') : args.indexOf('-c');
if (customFlagIndex > -1 && args[customFlagIndex + 1]) {
    // Grab the next argument as the path
    customPath = args[customFlagIndex + 1];
    // Basic cleanup to remove quotes if user added them manually in a weird way,
    // though shell usually handles this.
    customPath = customPath.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

// --------------------------------

// Calm initialization message
if (!isAuto) {
    console.log('\x1b[36m%s\x1b[0m', '› Initializing TXT-Forge...');
} else {
    console.log('\x1b[36m%s\x1b[0m', '› TXT-Forge Auto-Mode Initiated...');
    // UPDATED text to be clearer
    console.log('\x1b[90m%s\x1b[0m', `  Options: [Vault: ${isVault}] [Ignored Files: ${isHidden ? 'HIDDEN' : 'VISIBLE'}]`);
}

if (isDebug) console.log('\x1b[33m%s\x1b[0m', '› Debug Mode Enabled');

async function killPort(port) {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const command = isWin
            ? `netstat -ano | findstr :${port}`
            : `lsof -i :${port} -t`;
        exec(command, (err, stdout) => {
            if (!stdout) return resolve();
            // Inform user we are preparing the environment, not "cleaning up a mess"
            console.log('\x1b[90m%s\x1b[0m', '› Preparing local network environment...');

            const pids = stdout.trim().split(/\s+/);
            // Logic to kill PIDs (simplified for brevity, existing logic was fine, just needed silence)
             if (isWin) {
                 const lines = stdout.trim().split('\n');
                 const pid = lines[0].trim().split(/\s+/).pop();
                 if(pid) exec(`taskkill /PID ${pid} /F`, () => setTimeout(resolve, 500));
                 else resolve();
            } else {
                const pid = stdout.trim();
                if(pid) exec(`kill -9 ${pid}`, () => setTimeout(resolve, 500));
                else resolve();
            }
        });
    });
}

async function startServer() {
    await killPort(PORT);

    // In auto mode, we pipe stdout to 'ignore' to keep the CLI output clean from server logs
    // unless we are in debug mode.
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
        },
        stdio: stdioConfig
    });
    const url = `http://localhost:${PORT}`;
    // Wait for server to start
    setTimeout(async () => {

        if (isAuto) {
            // --- AUTO MODE LOGIC ---
            try {
                console.log('\x1b[90m%s\x1b[0m', '› Detecting stack and processing files...');

                // 1. Call the CLI-specific API endpoint
                const response = await fetch(`${url}/api/cli-forge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        saveToVault: isVault,
                        hideIgnoredInTree: isHidden, // <--- CHANGED
                        customPath: customPath // Pass the path
                    })
                });
                const result = await response.json();

                if (result.success) {
                    console.log('\x1b[32m%s\x1b[0m', '✓ Auto-Forge Complete!');

                    // Gitignore Warning
                    if (result.gitIgnoreModified) {
                        console.log('\x1b[33m%s\x1b[0m', '⚠ Note: Added "TXT-Forge/" to your .gitignore file.');
                    }

                    console.log('\x1b[90m%s\x1b[0m', `  Detected: ${result.detectedIds.join(', ') || 'None'}`);
                    console.log('\x1b[36m%s\x1b[0m', `  Output:   ${result.outputPath}`);
                    console.log('\x1b[90m%s\x1b[0m', `  Generated ${result.files.length} file(s).`);

                    // Open the folder automatically
                    // FIX: Ensure we wait for the OS command, and handle errors gracefully
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
                // FIX: Add a small delay before killing the process to ensure the 'open' command
                // fully detaches from the Node event loop.
                setTimeout(() => {
                    server.kill();
                    process.exit(0);
                }, 500);
            }
        } else {
            // --- UI MODE LOGIC ---
            console.log('\x1b[32m%s\x1b[0m', `✓ Ready. Opening ${url}`);
            console.log('\x1b[90m%s\x1b[0m', '  (Press Ctrl+C to exit manually)');
            await open(url);
        }
    }, 1500); // Gave it slightly more time (1.5s) to ensure SvelteKit cold start is ready

    process.on('SIGINT', () => {
        server.kill();
        process.exit();
    });
}

startServer();
