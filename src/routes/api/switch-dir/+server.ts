import { json } from '@sveltejs/kit';
import { restartApp } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // Restart the app in the new folder.
        // The frontend will lose connection, but the new instance will open a new tab.
        restartApp(path);
        
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

