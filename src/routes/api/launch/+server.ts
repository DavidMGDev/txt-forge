import { json } from '@sveltejs/kit';
import { launchNewInstance } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        // This spawns the process. The process itself (cli.js) handles opening the browser.
        await launchNewInstance(path);
        
        return json({ success: true });
    } catch (e: any) {
        console.error("Launch failed", e);
        return json({ success: false, message: e.message || "Unknown error" }, { status: 500 });
    }
}

