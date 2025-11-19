import { json } from '@sveltejs/kit';
import open from 'open';
import path from 'path';

export async function POST({ request }) {
    const { path: folderPath } = await request.json();
    try {
        await open(folderPath);
        return json({ success: true });
    } catch (e) {
        console.error(e);
        return json({ success: false }, { status: 500 });
    }
}
