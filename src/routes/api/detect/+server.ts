import { json } from '@sveltejs/kit';
import { detectCodebase } from '$lib/processor';

export async function GET() {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();
    const detected = await detectCodebase(cwd);
    return json({ detected, cwd });
}
