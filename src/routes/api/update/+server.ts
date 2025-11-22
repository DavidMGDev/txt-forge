import { json } from '@sveltejs/kit';
import { performGlobalUpdate } from '$lib/server/sys-utils';

export async function POST() {
    try {
        await performGlobalUpdate();
        return json({ success: true });
    } catch (e) {
        console.error("Update failed", e);
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

