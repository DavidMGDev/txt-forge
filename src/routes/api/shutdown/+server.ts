import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        // If JSON parsing fails (e.g. empty body or interrupted),
        // we assume it's a forced shutdown or old tab closing awkwardly.
        // We define a dummy body to safely check sessionId below.
        body = {};
    }

    const currentSessionId = process.env.FORGE_SESSION_ID;

    // Check ID (safely handles undefined body.sessionId)
    if (body.sessionId !== currentSessionId) {
        console.log('\x1b[33m%s\x1b[0m', '🛡️  Ignored shutdown signal from stale tab.');
        return json({ success: false, message: "Invalid Session ID" });
    }

    console.log('\x1b[31m%s\x1b[0m', '🛑 Browser closed. Shutting down TXT-FORGE...');

    setTimeout(() => {
        process.exit(0);
    }, 100);

    return json({ success: true });
}