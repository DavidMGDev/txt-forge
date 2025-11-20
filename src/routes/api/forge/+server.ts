import { json } from '@sveltejs/kit';
import { processFiles } from '$lib/processor';

export async function POST({ request }) {
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

    if (result.success) {
        // This log will appear in the user's terminal
        console.log('\x1b[36m%s\x1b[0m', `› Export successful: ${result.outputPath}`);
    }

    return json(result);
}
