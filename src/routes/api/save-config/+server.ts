import { json } from '@sveltejs/kit';
import { saveProjectConfig, getCwd } from '$lib/server/sys-utils';

export async function POST({ request }) {
    const { config } = await request.json();
    const path = getCwd();
    saveProjectConfig(path, config);
    return json({ success: true });
}
