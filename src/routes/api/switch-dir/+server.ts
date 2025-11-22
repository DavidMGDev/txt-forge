import { json } from '@sveltejs/kit';
import { setCwd } from '$lib/server/sys-utils';

export async function POST({ request }) {
    try {
        const { path } = await request.json();
        if (!path) return json({ success: false, message: "No path provided" });

        const success = setCwd(path);
        if (!success) return json({ success: false, message: "Invalid directory" });
        
        return json({ success: true });
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
}

