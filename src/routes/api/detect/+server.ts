import { json } from '@sveltejs/kit';
import { detectCodebase } from '$lib/processor';
import { loadConfig, loadProjectConfig, checkForUpdate, getCwd } from '$lib/server/sys-utils';
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
    const isSingleFileOverride = process.env.TXT_FORGE_SINGLE === 'true';

    // If override is active, force it into the project config sent to frontend
    if (isSingleFileOverride) {
        if (!projectConfig) {
            // @ts-ignore
            projectConfig = { disableSplitting: true };
        } else {
            projectConfig.disableSplitting = true;
        }
    }

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
        // DEBUG: Pass the env flag to the frontend
        isDebug: process.env.TXT_FORGE_DEBUG === 'true'
    });
}
