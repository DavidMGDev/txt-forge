import { json } from '@sveltejs/kit';
import { saveConfig } from '$lib/server/sys-utils';

export async function POST({ request }) {
    const { version } = await request.json();
    saveConfig({ lastSkippedVersion: version });
    return json({ success: true });
}

