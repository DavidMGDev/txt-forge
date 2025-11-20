import { json } from '@sveltejs/kit';
import { detectCodebase, processFiles } from '$lib/processor';

export async function POST({ request }) {
    const { saveToVault, includeIgnoredInTree, customPath } = await request.json();

    // 1. Determine Working Directory (Inherited from CLI env var)
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    // 2. Determine Save Mode
    // Custom takes precedence -> then Vault -> then Root (default)
    let saveMode: 'custom' | 'global' | 'root' = 'root';
    if (customPath) saveMode = 'custom';
    else if (saveToVault) saveMode = 'global';

    // 3. Run Auto-Detection
    const detection = await detectCodebase(cwd);

    // 4. Process Files (The "Forge" step) using detected templates
    const result = await processFiles({
        sourceDir: cwd,
        saveMode: saveMode,
        customPath: customPath,     // Pass the string (or undefined)
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
