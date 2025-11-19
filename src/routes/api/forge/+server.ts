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
        maxChars: body.maxChars
    });

    return json(result);
}
