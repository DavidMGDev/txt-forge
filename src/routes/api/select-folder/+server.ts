import { json } from '@sveltejs/kit';

import { pickDirectory, saveConfig } from '$lib/server/sys-utils';

export async function POST() {
    try {
        const path = await pickDirectory();

        if (path) {
            // Persist the selection immediately
            saveConfig({ lastCustomPath: path });
            return json({ success: true, path });
        }

        return json({ success: false, path: null });
    } catch (e) {
        console.error("Folder selection failed", e);
        return json({ success: false, error: "Failed to open dialog" }, { status: 500 });
    }
}
