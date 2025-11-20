export function logDebug(message, data = null) {
    if (process.env.TXT_FORGE_DEBUG === 'true') {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`\x1b[35m[DEBUG ${timestamp}]\x1b[0m ${message}`);
        if (data) {
            console.dir(data, { depth: 2, colors: true });
        }
    }
}
