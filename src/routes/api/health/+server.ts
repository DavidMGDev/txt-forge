import { json } from '@sveltejs/kit';
import { updateHeartbeat } from '$lib/server/session';

export function GET() {
    // Update the session monitor whenever the frontend pings
    updateHeartbeat();
    return json({ status: 'ok' });
}

