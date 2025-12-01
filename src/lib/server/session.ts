import process from 'process';

let lastHeartbeat = 0;
let isConnected = false;
let hasConnectedOnce = false;
let monitorInterval: NodeJS.Timeout | null = null;

const PORT = process.env.PORT || '4567';
const TIMEOUT_GRACE_MS = 10000; // 10 seconds to shutdown
const CONNECTION_LOST_THRESHOLD_MS = 3000; // 3 seconds to warn

export function startSessionMonitor() {
    if (monitorInterval) return;

    // Check every second
    monitorInterval = setInterval(() => {
        // Don't do anything if a browser has never connected
        if (!hasConnectedOnce) return;

        const now = Date.now();
        const diff = now - lastHeartbeat;

        if (isConnected && diff > CONNECTION_LOST_THRESHOLD_MS) {
            isConnected = false;
            console.log('\x1b[33m%s\x1b[0m', `\n[Warning] Connection to browser lost.`);
            console.log('\x1b[90m%s\x1b[0m', `To resume, reload the tab or open: http://localhost:${PORT}`);
            console.log('\x1b[90m%s\x1b[0m', `Shutting down in ${TIMEOUT_GRACE_MS / 1000} seconds if connection is not restored.\n`);
        }

        if (!isConnected && diff > (CONNECTION_LOST_THRESHOLD_MS + TIMEOUT_GRACE_MS)) {
            console.log('\x1b[31m%s\x1b[0m', `[Shutdown] No connection detected. Closing session.`);
            process.exit(0);
        }

    }, 1000);
}

export function updateHeartbeat() {
    const now = Date.now();

    // If we were disconnected and just got a ping, we are back
    if (!isConnected && hasConnectedOnce) {
        console.log('\x1b[32m%s\x1b[0m', `[Info] Browser connection restored.`);
    }

    lastHeartbeat = now;
    isConnected = true;
    hasConnectedOnce = true;

    startSessionMonitor(); // Ensure monitor is running
}
