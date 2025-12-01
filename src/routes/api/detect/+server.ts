import { json } from '@sveltejs/kit';
import { detectCodebase } from '$lib/processor';
import { loadConfig, loadProjectConfig, checkForUpdate, getCwd, APP_VERSION } from '$lib/server/sys-utils';
import os from 'os';
import path from 'path';

export async function GET() {
    const cwd = getCwd();
    const sessionId = process.env.FORGE_SESSION_ID;

    // 1. Run Detection
    const result = await detectCodebase(cwd);

    // 2. Load User Config
    const config = loadConfig();
    const { config: projectConfig, wasReset } = loadProjectConfig(cwd);

    // 3. Check for updates (Non-blocking ideal, but for simplicity we await fast)
    const updateInfo = await checkForUpdate();
    const shouldShowUpdate = updateInfo &&
        updateInfo.isUpdateAvailable &&
        config.lastSkippedVersion !== updateInfo.latest;

    // 4. Calculate Global Vault Path for display
    const globalPath = path.join(os.homedir(), '.txt-forge-vault');

    // 5. Check for CLI Overrides
    // (REMOVED: CLI Overrides Logic. UI Mode does not accept -s, -i, or -v flags)

    return json({
        ...result,
        cwd,
        sessionId,
        savedCustomPath: config.lastCustomPath || '',
        globalVaultPath: globalPath,
        projectConfig,
        configWasReset: wasReset,
        updateInfo,
        shouldShowUpdate,
        appVersion: APP_VERSION, // <--- Add this line
        // DEBUG: Pass the env flag to the frontend
        isDebug: process.env.TXT_FORGE_DEBUG === 'true'
    });
}
