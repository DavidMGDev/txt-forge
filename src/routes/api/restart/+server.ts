import { json } from '@sveltejs/kit';
import { restartApp } from '$lib/server/sys-utils';

export async function POST() {
    try {
        restartApp(); // Restarts in current CWD
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

