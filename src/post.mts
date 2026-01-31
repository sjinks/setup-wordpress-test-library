import { getState, info, warning } from '@actions/core';
import { saveCache } from '@actions/cache';

const tools = ['wordpress', 'wordpress-tests-lib'];

async function run(): Promise<void> {
    const ok = getState('ok_to_save_cache');
    if (ok !== 'yes') {
        warning(`⚠️ Something went wrong, not saving cache`);
        return;
    }

    for (const tool of tools) {
        const dir = getState(`dir_${tool}`);
        const key = getState(`cache_key_${tool}`);

        if (dir && key) {
            info(`ℹ️ Saving ${tool} cache with the key of ${key}`);
            try {
                process.env.GITHUB_WORKSPACE = dir;
                process.chdir(dir);
                // eslint-disable-next-line no-await-in-loop
                await saveCache([tool], key);
            } catch (e) {
                warning(`⚠️ Failed to save cache for ${tool}: ${(e as Error).message}`);
            }
        }
    }
}

await run();
