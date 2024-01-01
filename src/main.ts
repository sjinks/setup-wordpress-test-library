import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { symlink, writeFile } from 'node:fs/promises';
import { type InputOptions, exportVariable, getInput, info, saveState, setFailed, setOutput } from '@actions/core';
import { isFeatureAvailable as isCacheAvailable, restoreCache } from '@actions/cache';
import { cacheDir, downloadTool, extractZip, find as findTool } from '@actions/tool-cache';
import { mkdirP, rmRF } from '@actions/io';
import { coerce } from 'semver';
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
    semver: string | undefined;
}

/**
 * Get the inputs from the GitHub Actions environment.
 *
 * @returns {Inputs} The inputs for the script.
 */
function getInputs(): Inputs {
    const options: InputOptions = {
        required: false,
        trimWhitespace: true,
    };

    return {
        version: getInput('version', options) || 'latest',
        cache_prefix: getInput('cache_prefix', options) || '',
        dir: resolve(getInput('dir', options) || tmpdir()),
        db_user: getInput('db_user', options) || 'wordpress',
        db_password: getInput('db_password', options) || 'wordpress',
        db_name: getInput('db_name', options) || 'wordpress_test',
        db_host: getInput('db_host', options) || '127.0.0.1',
        has_cache: isCacheAvailable() && !isGHES(),
        has_toolcache: process.env.RUNNER_TOOL_CACHE !== undefined,
        semver: undefined,
    };
}

/**
 * Resolve the semantic version from the given version string.
 *
 * @param {string} version The version string to resolve.
 * @param {Inputs} inputs The inputs object to update.
 */
function resolveSemVer(version: string, inputs: Inputs): void {
    inputs.semver = coerce(version)?.format();
    if (!inputs.semver) {
        inputs.has_cache = false;
        inputs.has_toolcache = false;
    }
}

/**
 * Find the cached version of the given tool.
 *
 * @async
 * @param {string} name The name of the tool.
 * @param {string} tool The tool to find.
 * @param {Inputs} inputs The inputs for the script.
 * @returns {Promise<boolean>} True if the tool was found in the cache, false otherwise.
 */
async function findCached(name: string, tool: string, inputs: Inputs): Promise<boolean> {
    if (!inputs.has_toolcache && inputs.semver) {
        const cachePath = findTool(tool, inputs.semver);
        if (cachePath) {
            const resolvedPath = resolve(cachePath);
            info(`🚀 Using cached ${name} from ${resolvedPath}`);
            await symlink(resolvedPath, `${inputs.dir}/${tool}`);
            return true;
        }
    }

    if (inputs.has_cache) {
        const key = `1:${inputs.cache_prefix}:${tool}:${inputs.semver}`;

        info(`ℹ️ Checking cache key ${key} for ${tool}…`);
        const result = await restoreCache([tool], key);

        if (result) {
            info(`🚀 Using cached ${name}, key is ${key}`);
            return true;
        }

        saveState(`dir_${tool}`, inputs.dir);
        saveState(`cache_key_${tool}`, key);
    }

    return false;
}

/**
 * Download WordPress and extract it to the given directory.
 *
 * @async
 * @param {string} url The URL to download WordPress from.
 * @param {Inputs} inputs The inputs for the script.
 */
async function downloadWordPress(url: string, inputs: Inputs): Promise<void> {
    const dest = join(inputs.dir, 'wordpress.zip');
    try {
        if (await findCached('WordPress', 'wordpress', inputs)) {
            return;
        }

        info(`📥 Downloading WordPress…`);
        const file = await downloadTool(url, dest);
        const targetDir = await extractZip(file, inputs.dir);
        if (inputs.has_toolcache) {
            await cacheDir(`${targetDir}/wordpress`, 'wordpress', inputs.semver!);
        }
    } finally {
        await rmRF(dest);
    }
}

/**
 * Download the WordPress Test Library and extract it to the given directory.
 *
 * @async
 * @param {string} url The URL to download the WordPress Test Library from.
 * @param {Inputs} inputs The inputs for the script.
 */
async function downloadTestLibrary(url: string, inputs: Inputs): Promise<void> {
    if (await findCached('WordPress Test Library', 'wordpress-tests-lib', inputs)) {
        return;
    }

    info(`📥 Downloading WordPress Test Library…`);
    await mkdirP(join(inputs.dir, 'wordpress-tests-lib'));
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
        await cacheDir(`${inputs.dir}/wordpress-tests-lib`, 'wordpress-tests-lib', inputs.semver!);
    }
}

/**
 * Configure WordPress with the given inputs.
 *
 * @async
 * @param {string} wptlUrl The URL to the WordPress Test Library.
 * @param {Inputs} inputs The inputs for the script.
 */
async function configureWordPress(wptlUrl: string, inputs: Inputs): Promise<void> {
    const config = (await downloadAsText(`${wptlUrl}/wp-tests-config-sample.php`))
        .replace('youremptytestdbnamehere', inputs.db_name)
        .replace('yourusernamehere', inputs.db_user)
        .replace('yourpasswordhere', inputs.db_password)
        .replace('localhost', inputs.db_host)
        .replace("dirname( __FILE__ ) . '/src/'", `'${inputs.dir}/wordpress/'`);
    await writeFile(join(inputs.dir, 'wordpress-tests-lib', 'wp-tests-config.php'), config);
}

async function run(): Promise<void> {
    try {
        const inputs = getInputs();

        if (!(await isDir(inputs.dir))) {
            throw new Error(`Directory ${inputs.dir} does not exist`);
        }

        info('🤔 Determining WordPress version…');
        const wpVersion = await resolveWordPressVersion(inputs.version);
        info(`ℹ️ WordPress version: ${wpVersion}`);
        setOutput('wp_version', wpVersion);

        resolveSemVer(wpVersion, inputs);

        await Promise.all([
            rmRF(join(inputs.dir, 'wordpress')),
            rmRF(join(inputs.dir, 'wordpress-tests-lib')),
            rmRF(join(inputs.dir, 'wordpress.zip')),
        ]);

        info(`ℹ️ Cache is available: ${inputs.has_cache ? 'yes' : 'no'}`);
        info(`ℹ️ Tool cache is available: ${inputs.has_toolcache ? 'yes' : 'no'}`);

        const wpUrl = getWordPressDownloadUrl(wpVersion);
        const wptlUrl = getWordPressTestLibraryBaseUrl(wpVersion);
        const workspace = process.env.GITHUB_WORKSPACE;
        try {
            process.env.GITHUB_WORKSPACE = inputs.dir;
            await Promise.all([downloadWordPress(wpUrl, inputs), downloadTestLibrary(wptlUrl, inputs)]);
        } finally {
            // eslint-disable-next-line require-atomic-updates
            process.env.GITHUB_WORKSPACE = workspace;
        }

        info('⚙️ Configuring WordPress…');
        await configureWordPress(wptlUrl, inputs);

        exportVariable('WP_TESTS_DIR', join(inputs.dir, 'wordpress-tests-lib'));
        setOutput('wp_directory', join(inputs.dir, 'wordpress'));
        setOutput('wptl_directory', join(inputs.dir, 'wordpress-tests-lib'));
        info('✅ Success');
    } catch (error) {
        setFailed(`❌ ${(error as Error).message}`);
    }
}

void run();
