import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { symlink, writeFile } from 'node:fs/promises';
import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as tc from '@actions/tool-cache';
import { mkdirP, rmRF } from '@actions/io';
import coerce from 'semver/functions/coerce';
import { SVNClient } from '@taiyosen/easy-svn';
import { downloadAsText, isDir, isGHES } from './utils';
import { getWordPressDownloadUrl, getWordPressTestLibraryBaseUrl, resolveWordPressVersion } from './wputils';

interface Inputs {
    version: string;
    dir: string;
    cache_prefix: string;
    db_user: string;
    db_password: string;
    db_name: string;
    db_host: string;
    has_cache: boolean;
    has_toolcache: boolean;
    semver: string | null | undefined;
}

function getInputs(): Inputs {
    const options: core.InputOptions = {
        required: false,
        trimWhitespace: true,
    };

    const result: Inputs = {
        version: core.getInput('version', options) || 'latest',
        cache_prefix: core.getInput('cache_prefix', options) || '',
        dir: core.getInput('dir', options) || tmpdir(),
        db_user: core.getInput('db_user', options) || 'wordpress',
        db_password: core.getInput('db_password', options) || 'wordpress',
        db_name: core.getInput('db_name', options) || 'wordpress_test',
        db_host: core.getInput('db_host', options) || '127.0.0.1',
        has_cache: cache.isFeatureAvailable() && !isGHES(),
        has_toolcache: process.env.RUNNER_TOOL_CACHE !== undefined,
        semver: null,
    };

    result.dir = path.resolve(result.dir);
    return result;
}

function resolveSemVer(version: string, inputs: Inputs): void {
    inputs.semver = coerce(version)?.format();
    if (!inputs.semver) {
        inputs.has_cache = false;
        inputs.has_toolcache = false;
    }
}

async function findCached(name: string, tool: string, inputs: Inputs): Promise<boolean> {
    if (!inputs.has_toolcache && inputs.semver) {
        const cachePath = tc.find(tool, inputs.semver);
        if (cachePath) {
            const resolvedPath = path.resolve(cachePath);
            core.info(`🚀 Using cached ${name} from ${resolvedPath}`);
            await symlink(resolvedPath, `${inputs.dir}/${tool}`);
            return true;
        }
    }

    if (inputs.has_cache) {
        const key = `1:${inputs.cache_prefix}:${tool}:${inputs.semver}`;
        const workspace = process.env.GITHUB_WORKSPACE;
        try {
            process.env.GITHUB_WORKSPACE = inputs.dir;

            core.info(`ℹ️ Checking cache key ${key} for ${tool}…`);
            const result = await cache.restoreCache([tool], key);

            if (result) {
                core.info(`🚀 Using cached ${name}, key is ${key}`);
                return true;
            }
        } finally {
            // eslint-disable-next-line require-atomic-updates
            process.env.GITHUB_WORKSPACE = workspace;
        }

        core.saveState(`dir_${tool}`, inputs.dir);
        core.saveState(`cache_key_${tool}`, key);
    }

    return false;
}

async function downloadWordPress(url: string, inputs: Inputs): Promise<void> {
    const dest = path.join(inputs.dir, 'wordpress.zip');
    try {
        if (await findCached('WordPress', 'wordpress', inputs)) {
            return;
        }

        core.info(`📥 Downloading WordPress…`);
        const file = await tc.downloadTool(url, dest);
        const targetDir = await tc.extractZip(file, inputs.dir);
        if (inputs.has_toolcache) {
            await tc.cacheDir(`${targetDir}/wordpress`, 'wordpress', inputs.semver as string);
        }
    } finally {
        await rmRF(dest);
    }
}

async function downloadTestLibrary(url: string, inputs: Inputs): Promise<void> {
    if (await findCached('WordPress Test Library', 'wordpress-tests-lib', inputs)) {
        return;
    }

    core.info(`📥 Downloading WordPress Test Library…`);
    await mkdirP(path.join(inputs.dir, 'wordpress-tests-lib'));
    const client = new SVNClient();
    client.setConfig({ silent: true });
    await Promise.all([
        client.checkout(`${url}/tests/phpunit/includes/`, `${inputs.dir}/wordpress-tests-lib/includes`),
        client.checkout(`${url}/tests/phpunit/data/`, `${inputs.dir}/wordpress-tests-lib/data`),
    ]);

    await Promise.all([
        rmRF(`${inputs.dir}/wordpress-tests-lib/includes/.svn`),
        rmRF(`${inputs.dir}/wordpress-tests-lib/data/.svn`),
    ]);

    if (inputs.has_toolcache) {
        await tc.cacheDir(`${inputs.dir}/wordpress-tests-lib`, 'wordpress-tests-lib', inputs.semver as string);
    }
}

async function configureWordPress(wptlUrl: string, inputs: Inputs): Promise<void> {
    const config = (await downloadAsText(`${wptlUrl}/wp-tests-config-sample.php`))
        .replace('youremptytestdbnamehere', inputs.db_name)
        .replace('yourusernamehere', inputs.db_user)
        .replace('yourpasswordhere', inputs.db_password)
        .replace('localhost', inputs.db_host)
        .replace("dirname( __FILE__ ) . '/src/'", `'${inputs.dir}/wordpress/'`);
    await writeFile(path.join(inputs.dir, 'wordpress-tests-lib', 'wp-tests-config.php'), config);
}

async function run(): Promise<void> {
    try {
        const inputs = getInputs();

        if (!(await isDir(inputs.dir))) {
            throw new Error(`Directory ${inputs.dir} does not exist`);
        }

        core.info('🤔 Determining WordPress version…');
        const wpVersion = await resolveWordPressVersion(inputs.version);
        core.info(`ℹ️ WordPress version: ${wpVersion}`);
        core.setOutput('wp_version', wpVersion);

        resolveSemVer(wpVersion, inputs);

        await Promise.all([
            rmRF(path.join(inputs.dir, 'wordpress')),
            rmRF(path.join(inputs.dir, 'wordpress-tests-lib')),
            rmRF(path.join(inputs.dir, 'wordpress.zip')),
        ]);

        core.info(`ℹ️ Cache is available: ${inputs.has_cache ? 'yes' : 'no'}`);
        core.info(`ℹ️ Tool cache is available: ${inputs.has_toolcache ? 'yes' : 'no'}`);

        const wpUrl = getWordPressDownloadUrl(wpVersion);
        const wptlUrl = getWordPressTestLibraryBaseUrl(wpVersion);
        await Promise.all([downloadWordPress(wpUrl, inputs), downloadTestLibrary(wptlUrl, inputs)]);

        core.info('⚙️ Configuring WordPress…');
        await configureWordPress(wptlUrl, inputs);

        core.exportVariable('WP_TESTS_DIR', path.join(inputs.dir, 'wordpress-tests-lib'));
        core.setOutput('wp_directory', path.join(inputs.dir, 'wordpress'));
        core.setOutput('wptl_directory', path.join(inputs.dir, 'wordpress-tests-lib'));
        core.info('✅ Success');
    } catch (error) {
        core.setFailed(`❌ ${(error as Error).message}`);
    }
}

void run();
