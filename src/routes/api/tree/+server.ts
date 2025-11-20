import { json } from '@sveltejs/kit';
import { scanDirectory } from '$lib/tree';
import { templates } from '$lib/templates';

export async function GET({ url }) {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    // Get selected template IDs from query string
    const templateIds = url.searchParams.get('templates')?.split(',') || [];

    // Gather ignore patterns from these templates
    const templateIgnores: string[] = [];
    templateIds.forEach(id => {
        const t = templates.find(tmpl => tmpl.id === id);
        if (t) {
            t.ignores.forEach(ign => templateIgnores.push(ign));
        }
    });

    try {
        // Pass ignores to scanner
        const tree = await scanDirectory(cwd, cwd, 0, templateIgnores);
        return json({ tree });
    } catch (e) {
        console.error(e);
        return json({ tree: [] }, { status: 500 });
    }
}
