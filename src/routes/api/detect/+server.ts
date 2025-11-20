import { json } from '@sveltejs/kit';
import { detectCodebase } from '$lib/processor';

export async function GET() {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();
    // Pass the Session ID generated in bin/cli.js to the frontend
    const sessionId = process.env.FORGE_SESSION_ID;

    const result = await detectCodebase(cwd);

    return json({ ...result, cwd, sessionId });
}
