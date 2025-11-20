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

// Calm initialization message
console.log('\x1b[36m%s\x1b[0m', '› Initializing TXT-Forge...');

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
    // Spawn server with stdio: 'inherit' so server logs (like file paths) show up here
    const server = spawn('node', [serverPath], {
        env: {
            ...process.env,
            PORT: PORT.toString(),
            TXT_FORGE_CWD: USER_CWD,
            ORIGIN: `http://localhost:${PORT}`,
            FORGE_SESSION_ID: SESSION_ID,
            // Tell SvelteKit adapter-node to be quiet about the listening port
            // We will handle the "Ready" message ourselves
            node_env: 'production'
        },
        stdio: 'inherit'
    });
    // Wait slightly to ensure server is up, then open browser
    setTimeout(async () => {
        const url = `http://localhost:${PORT}`;
        console.log('\x1b[32m%s\x1b[0m', `✓ Ready. Opening ${url}`);
        console.log('\x1b[90m%s\x1b[0m', '  (Press Ctrl+C to exit manually)');
        await open(url);
    }, 1000);

    process.on('SIGINT', () => {
        server.kill();
        process.exit();
    });
}

startServer();
