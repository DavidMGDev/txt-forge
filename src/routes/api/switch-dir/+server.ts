import { json } from '@sveltejs/kit';
import { relaunchInNewWindow } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // Launch the new CMD window (it has a 2s delay built-in)
        relaunchInNewWindow(path);
        
        // Return success immediately so Frontend can close the window
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

