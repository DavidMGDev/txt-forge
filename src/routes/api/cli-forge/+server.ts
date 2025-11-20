import { json } from '@sveltejs/kit';
import { detectCodebase, processFiles } from '$lib/processor';

export async function POST({ request }) {
    const { saveToVault, includeIgnoredInTree } = await request.json();

    // 1. Determine Working Directory (Inherited from CLI env var)
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    // 2. Run Auto-Detection
    const detection = await detectCodebase(cwd);

    // 3. Process Files (The "Forge" step) using detected templates
    const result = await processFiles({
        sourceDir: cwd,
        saveMode: saveToVault ? 'global' : 'root',
        templateIds: detection.ids, // Use all detected templates
        maxChars: 75000,            // Default max chars
        selectedFiles: undefined,   // Undefined means "use templates to decide"
        includeIgnoredInTree: includeIgnoredInTree
    });

    return json({
        ...result,
        detectedIds: detection.ids
    });
}
