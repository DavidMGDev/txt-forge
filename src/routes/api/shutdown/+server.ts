import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    let body = {};
    try { body = await request.json(); } catch (e) {}

    const currentSessionId = process.env.FORGE_SESSION_ID;
    if (body.sessionId !== currentSessionId) {
        // Silent return for stale tabs
        return json({ success: false });
    }

    console.log('\n\x1b[32m%s\x1b[0m', '✓ Session finished. Thanks for using TXT-Forge.');

    setTimeout(() => {
        process.exit(0);
    }, 100);
    return json({ success: true });
}