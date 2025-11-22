import { json } from '@sveltejs/kit';
import { detectCodebase, processFiles } from '$lib/processor';
import { loadProjectConfig } from '$lib/server/sys-utils'; // <--- NEW

export async function POST({ request }) {
    const { saveToVault, hideIgnoredInTree, customPath } = await request.json();

    // 1. Determine Working Directory (Inherited from CLI env var)
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    // 2. Determine Save Mode
    // Custom takes precedence -> then Vault -> then Root (default)
    let saveMode: 'custom' | 'global' | 'root' = 'root';
    if (customPath) saveMode = 'custom';
    else if (saveToVault) saveMode = 'global';

    // 3. Run Auto-Detection
    const detection = await detectCodebase(cwd);

    // Load Project Config
    const { config: projectConfig } = loadProjectConfig(cwd);

    // Determine settings based on config (if exists AND has specific data), otherwise fallback to detection
    const templatesToUse = (projectConfig && projectConfig.templateIds && projectConfig.templateIds.length > 0) 
        ? projectConfig.templateIds 
        : detection.ids;
        
    const selectedFilesToUse = (projectConfig && projectConfig.selectedFiles) 
        ? projectConfig.selectedFiles 
        : undefined;

    // CLI flag overrides config if explicitly passed (logic: if hideIgnoredInTree is true from CLI, use it, else check config)

    // However, CLI 'hideIgnoredInTree' comes from a flag.

    // If user didn't pass flag, CLI passes false? In CLI.js: const isHidden = args.includes...

    // Actually, simple logic: Use config if exists, otherwise default.

    // But if user passes explicit CLI flags, they might expect override.

    // For now, let's prioritize Config for 'selectedFiles' and 'templates'.

    // For 'hideIgnored', we prioritize the CLI flag if it matches the intent (hidden), otherwise config.

    let finalHideIgnored = hideIgnoredInTree;
    if (projectConfig && projectConfig.hideIgnoredInTree !== undefined) {
        // If CLI flag was NOT set (false), use config. If CLI flag WAS set (true), use CLI.
        // Actually, just usage of config is preferred for consistency.
        finalHideIgnored = projectConfig.hideIgnoredInTree;
    }

    const maxCharsToUse = (projectConfig && projectConfig.maxChars) ? projectConfig.maxChars : 75000; // <--- ADDED

    // 4. Process Files (The "Forge" step) using detected templates
    const result = await processFiles({
        sourceDir: cwd,
        saveMode: saveMode,
        customPath: customPath,
        templateIds: templatesToUse, // Use config or detected
        maxChars: maxCharsToUse,     // <--- UPDATED
        selectedFiles: selectedFilesToUse, // Use config files or undefined
        hideIgnoredInTree: finalHideIgnored
    });

    return json({
        ...result,
        detectedIds: detection.ids
    });
}
