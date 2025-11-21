import { json } from '@sveltejs/kit';
import { processFiles } from '$lib/processor';
import { logDebug } from '$lib/server/logger'; // <--- Import Logger

export async function POST({ request }) {
    logDebug('Forge request received');
    const body = await request.json();
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();

    const result = await processFiles({
        sourceDir: cwd,
        saveMode: body.saveMode,
        customPath: body.customPath,
        templateIds: body.templateIds,
        maxChars: body.maxChars,
        selectedFiles: body.selectedFiles,
        hideIgnoredInTree: body.hideIgnoredInTree // <--- ADDED
    });

    logDebug('Forge processing complete', result.success);

    if (result.success) {
        // This log will appear in the user's terminal
        console.log('\x1b[36m%s\x1b[0m', `› Export successful: ${result.outputPath}`);
    } else {
        logDebug('Forge failed details', result.message);
    }

    return json(result);
}
