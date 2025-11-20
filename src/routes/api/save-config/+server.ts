import { json } from '@sveltejs/kit';
import { saveProjectConfig } from '$lib/server/sys-utils';

export async function POST({ request }) {
    const { path, config } = await request.json();
    saveProjectConfig(path, config);
    return json({ success: true });
}
