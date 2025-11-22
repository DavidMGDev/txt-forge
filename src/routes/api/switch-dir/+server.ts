import { json } from '@sveltejs/kit';
import { triggerRestart } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // Signal parent to restart in new path
        triggerRestart(path);
        
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

