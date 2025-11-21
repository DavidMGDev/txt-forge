import { json } from '@sveltejs/kit';
import open from 'open';
import path from 'path';
import { logDebug } from '$lib/server/logger'; // <--- Import Logger

export async function POST({ request }) {
    const { path: folderPath } = await request.json();
    logDebug('Opening folder:', folderPath);
    try {
        await open(folderPath);
        return json({ success: true });
    } catch (e) {
        console.error(e);
        logDebug('Failed to open folder', e);
        return json({ success: false }, { status: 500 });
    }
}
