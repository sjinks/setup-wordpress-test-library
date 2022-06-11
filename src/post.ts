import * as core from '@actions/core';
import * as cache from '@actions/cache';

const tools = ['wordpress', 'wordpress-tests-lib'];

async function run(): Promise<void> {
    for (const tool of tools) {
        const dir = core.getState(`dir_${tool}`);
        const key = core.getState(`cache_key_${tool}`);

        if (dir && key) {
            core.info(`ℹ️ Saving ${tool} cache with the key of ${key}`);
            try {
                process.env.GITHUB_WORKSPACE = dir;
                process.chdir(dir);
                // eslint-disable-next-line no-await-in-loop
                await cache.saveCache([tool], key);
            } catch (e) {
                core.warning(`⚠️ Failed to save cache for ${tool}: ${(e as Error).message}`);
            }
        }
    }
}

void run();
