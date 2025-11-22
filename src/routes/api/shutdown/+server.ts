import { json } from '@sveltejs/kit';
import { triggerShutdown } from '$lib/server/sys-utils';

export async function POST({ request }) {
    let body = {};
    try { body = await request.json(); } catch (e) {}

    const currentSessionId = process.env.FORGE_SESSION_ID;
    if (body.sessionId !== currentSessionId) {
        return json({ success: false });
    }

    console.log('\n\x1b[32m%s\x1b[0m', '✓ Session finished via UI.');
    
    // Signal parent to stop the loop
    triggerShutdown();
    
    return json({ success: true });
}