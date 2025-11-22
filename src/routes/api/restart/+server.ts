import { json } from '@sveltejs/kit';
import { triggerRestart } from '$lib/server/sys-utils';

export async function POST() {
    try {
        // Signal parent to restart in CURRENT path
        triggerRestart(null);
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

