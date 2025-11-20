#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '../build/index.js');
const USER_CWD = process.cwd();
const PORT = 4567;
const SESSION_ID = randomUUID();

console.log('\x1b[36m%s\x1b[0m', '🔥 TXT-FORGE is heating up...');

async function killPort(port) {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';

        if (isWin) {
            // Windows: Find PID and kill
            exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
                if (!stdout) return resolve(); // Port not in use

                const lines = stdout.trim().split('\n');
                if (lines.length === 0) return resolve();

                const pid = lines[0].trim().split(/\s+/).pop();
                if (pid) {
                    console.log('\x1b[33m%s\x1b[0m', `⚠️  Port ${port} in use (PID: ${pid}). Cleaning up...`);
                    exec(`taskkill /PID ${pid} /F`, () => {
                        setTimeout(resolve, 500); // Give OS time to release
                    });
                } else {
                    resolve();
                }
            });
        } else {
            // Mac/Linux
            exec(`lsof -i :${port} -t`, (err, stdout) => {
                if (!stdout) return resolve();
                const pid = stdout.trim();
                if (pid) {
                     console.log('\x1b[33m%s\x1b[0m', `⚠️  Port ${port} in use. Cleaning up...`);
                    exec(`kill -9 ${pid}`, () => {
                        setTimeout(resolve, 500);
                    });
                } else {
                    resolve();
                }
            });
        }
    });
}

async function startServer() {
    // 1. Ensure port is free
    await killPort(PORT);

    // 2. Start Server
    const server = spawn('node', [serverPath], {
        env: {
            ...process.env,
            PORT: PORT.toString(),
            TXT_FORGE_CWD: USER_CWD,
            ORIGIN: `http://localhost:${PORT}`,
            FORGE_SESSION_ID: SESSION_ID
        },
        stdio: 'inherit'
    });

    // 3. Open Browser
    setTimeout(async () => {
        const url = `http://localhost:${PORT}`;
        console.log('\x1b[32m%s\x1b[0m', `✓ Forge ready at ${url}`);
        await open(url);
    }, 1500);

    process.on('SIGINT', () => {
        server.kill();
        process.exit();
    });
}

startServer();
