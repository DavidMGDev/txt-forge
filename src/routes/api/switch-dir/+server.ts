import { json } from '@sveltejs/kit';
import { relaunchInNewWindow } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // Trigger the detached process. 
        // It has a built-in delay (sleep/timeout) to wait for us to close.
        relaunchInNewWindow(path);
        
        // Return success immediately so Frontend can trigger exitApp()
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

