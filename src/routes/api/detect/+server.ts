import { json } from '@sveltejs/kit';
import { detectCodebase } from '$lib/processor';
import { loadConfig, loadProjectConfig } from '$lib/server/sys-utils'; // <--- UPDATED
import os from 'os';
import path from 'path';

export async function GET() {
    const cwd = process.env.TXT_FORGE_CWD || process.cwd();
    const sessionId = process.env.FORGE_SESSION_ID;

    // 1. Run Detection
    const result = await detectCodebase(cwd);

    // 2. Load User Config
    const config = loadConfig();
    const { config: projectConfig, wasReset } = loadProjectConfig(cwd); // <--- UPDATED: Destructure result

    // 3. Calculate Global Vault Path for display
    const globalPath = path.join(os.homedir(), '.txt-forge-vault');

    return json({
        ...result,
        cwd,
        sessionId,
        savedCustomPath: config.lastCustomPath || '',
        globalVaultPath: globalPath,
        projectConfig,
        configWasReset: wasReset, // <--- NEW: Inform frontend
        // DEBUG: Pass the env flag to the frontend
        isDebug: process.env.TXT_FORGE_DEBUG === 'true'
    });
}
