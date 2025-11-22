import { json } from '@sveltejs/kit';
import { setCwd } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // Cross-Platform: Update internal state immediately.
        // The frontend will reload the page, triggering a new detection on the new CWD.
        const success = setCwd(path);
        
        if (success) {
            return json({ success: true });
        } else {
            return json({ success: false, message: "Directory does not exist" }, { status: 400 });
        }
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

