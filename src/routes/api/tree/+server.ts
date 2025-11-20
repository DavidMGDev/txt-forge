import { json } from '@sveltejs/kit';
import { scanDirectory } from '$lib/tree';
import { templates } from '$lib/templates';
import path from 'path'; // Import path

export async function GET({ url }) {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    // NEW: Lazy Load support
    const subPath = url.searchParams.get('path') || '';
    const scanRoot = path.join(cwd, subPath);

    // FIX: Calculate depth based on path segments so indentation aligns correctly

    // If subPath is "node_modules" (1 segment), items inside are at depth 1.

    // If subPath is empty (root), items are at depth 0.

    const startDepth = subPath ? subPath.split(/[/\\]/).length : 0;

    // Get selected template IDs
    const templateIds = url.searchParams.get('templates')?.split(',') || [];
    const templateIgnores: string[] = [];
    templateIds.forEach(id => {
        const t = templates.find(tmpl => tmpl.id === id);
        if (t) {
            t.ignores.forEach(ign => templateIgnores.push(ign));
        }
    });
    try {
        // We pass the ROOT (cwd) as the first arg so relative paths remain correct (e.g. src/lib/...)
        // We pass the ACTUAL folder to scan as second arg
        // We pass 'true' as the 5th argument if 'subPath' exists, meaning this is a specific lazy load request
        const isLazyRequest = !!subPath;
        const tree = await scanDirectory(cwd, scanRoot, startDepth, templateIgnores, isLazyRequest);
        return json({ tree });
    } catch (e) {
        console.error(e);
        return json({ tree: [] }, { status: 500 });
    }
}
