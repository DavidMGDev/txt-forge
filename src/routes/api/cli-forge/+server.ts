import { json } from '@sveltejs/kit';
import { detectCodebase, processFiles } from '$lib/processor';
import { loadProjectConfig, checkForUpdate, getCwd } from '$lib/server/sys-utils';

export async function POST({ request }) {
    const { saveToVault, hideIgnoredInTree, customPath } = await request.json();

    // 1. Determine Working Directory
    const cwd = getCwd();

    // 2. Determine Save Mode
    let saveMode: 'custom' | 'global' | 'root' = 'root';
    if (customPath) saveMode = 'custom';
    else if (saveToVault) saveMode = 'global';

    // 3. Run Auto-Detection
    const detection = await detectCodebase(cwd);

    // 4. Load Config & Check Reset & Check Updates
    const { config: projectConfig, wasReset } = loadProjectConfig(cwd);
    const updateInfo = await checkForUpdate();

    // Determine settings based on config (if exists AND has specific data), otherwise fallback to detection
    const templatesToUse = (projectConfig && projectConfig.templateIds && projectConfig.templateIds.length > 0)
        ? projectConfig.templateIds
        : detection.ids;

    // UPDATED: Use selectionRules instead of selectedFiles (from previous guide)
    const selectionRulesToUse = (projectConfig && projectConfig.selectionRules)
        ? projectConfig.selectionRules
        : undefined;

    // CLI flag overrides config if explicitly passed
    let finalHideIgnored = hideIgnoredInTree;
    if (projectConfig && projectConfig.hideIgnoredInTree !== undefined) {
        finalHideIgnored = projectConfig.hideIgnoredInTree;
    }

    const maxCharsToUse = (projectConfig && projectConfig.maxChars) ? projectConfig.maxChars : 75000;

    // NEW: Load Single File Mode setting
    // Check CLI Override first, then Config, then Default
    const isSingleFileOverride = process.env.TXT_FORGE_SINGLE === 'true';

    const disableSplittingToUse = isSingleFileOverride
        ? true
        : (projectConfig && projectConfig.disableSplitting) !== undefined
            ? projectConfig.disableSplitting
            : false;

    // 4. Process Files (The "Forge" step) using detected templates
    const result = await processFiles({
        sourceDir: cwd,
        saveMode: saveMode,
        customPath: customPath,
        templateIds: templatesToUse,
        maxChars: maxCharsToUse,
        selectionRules: selectionRulesToUse, // <--- UPDATED to use rules
        hideIgnoredInTree: finalHideIgnored,
        disableSplitting: disableSplittingToUse // <--- ADDED
    });

    return json({
        ...result,
        detectedIds: detection.ids,
        configWasReset: wasReset,
        updateInfo
    });
}
