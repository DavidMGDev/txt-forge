import { json } from '@sveltejs/kit';
import { scanDirectory } from '$lib/tree';

export async function GET() {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    try {
        const tree = await scanDirectory(cwd, cwd);
        return json({ tree });
    } catch (e) {
        console.error(e);
        return json({ tree: [] }, { status: 500 });
    }
}
