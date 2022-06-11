import { tmpdir } from 'node:os';
import path from 'node:path';
import { symlink, writeFile } from 'node:fs/promises';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { mkdirP, rmRF } from '@actions/io';
import coerce from 'semver/functions/coerce';
import { SVNClient } from '@taiyosen/easy-svn';
import { downloadAsText, isDir } from './utils';
import { getWordPressDownloadUrl, getWordPressTestLibraryBaseUrl, resolveWordPressVersion } from './wputils';

interface Inputs {
    version: string;
    cache: boolean;
    dir: string;
    db_user: string;
    db_password: string;
    db_name: string;
    db_host: string;
}

function getInputs(): Inputs {
    const options: core.InputOptions = {
        required: false,
        trimWhitespace: true,
    };

    const result: Inputs = {
        version: core.getInput('version', options) || 'latest',
        cache: core.getBooleanInput('cache', options) && process.env.RUNNER_TOOL_CACHE !== undefined,
        dir: core.getInput('dir', options) || tmpdir(),
        db_user: core.getInput('db_user', options) || 'wordpress',
        db_password: core.getInput('db_password', options) || 'wordpress',
        db_name: core.getInput('db_name', options) || 'wordpress_test',
        db_host: core.getInput('db_host', options) || '127.0.0.1',
    };

    result.dir = path.resolve(result.dir);

    return result;
}

async function findCached(name: string, tool: string, version: string, dir: string): Promise<boolean> {
    const cachePath = tc.find(tool, version);
    if (cachePath) {
        const resolvedPath = path.resolve(cachePath);
        core.info(`🚀 Using cached ${name} from ${resolvedPath}`);
        await symlink(resolvedPath, `${dir}/${tool}`);
        return true;
    }

    return false;
}

async function downloadWordPress(url: string, dir: string, version: string, cache: boolean): Promise<void> {
    const dest = path.join(dir, 'wordpress.zip');
    try {
        if (cache && version && (await findCached('WordPress', 'wordpress', version, dir))) {
            return;
        }

        core.info(`📥 Downloading WordPress…`);
        const file = await tc.downloadTool(url, dest);
        const targetDir = await tc.extractZip(file, dir);
        if (cache && version) {
            await tc.cacheDir(`${targetDir}/wordpress`, 'wordpress', version);
        }
    } finally {
        await rmRF(dest);
    }
}

async function downloadTestLibrary(url: string, dir: string, version: string, cache: boolean): Promise<void> {
    if (cache && version && (await findCached('WordPress Test Library', 'wordpress-tests-lib', version, dir))) {
        return;
    }

    core.info(`📥 Downloading WordPress Test Library…`);
    await mkdirP(path.join(dir, 'wordpress-tests-lib'));
    const client = new SVNClient();
    client.setConfig({ silent: true });
    await Promise.all([
        client.checkout(`${url}/tests/phpunit/includes/`, `${dir}/wordpress-tests-lib/includes`),
        client.checkout(`${url}/tests/phpunit/data/`, `${dir}/wordpress-tests-lib/data`),
    ]);

    await Promise.all([rmRF(`${dir}/wordpress-tests-lib/includes/.svn`), rmRF(`${dir}/wordpress-tests-lib/data/.svn`)]);

    if (cache && version) {
        await tc.cacheDir(`${dir}/wordpress-tests-lib`, 'wordpress-tests-lib', version);
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
        const wpSemVer = coerce(wpVersion)?.format() || '';
        core.info(`ℹ️ WordPress version: ${wpVersion}`);
        core.setOutput('wp_version', wpVersion);

        await Promise.all([
            rmRF(path.join(inputs.dir, 'wordpress')),
            rmRF(path.join(inputs.dir, 'wordpress-tests-lib')),
            rmRF(path.join(inputs.dir, 'wordpress.zip')),
        ]);

        if (wpVersion === 'nightly' && inputs.cache) {
            inputs.cache = false;
            core.info('⚠️ Not caching nightly build');
        }

        const wpUrl = getWordPressDownloadUrl(wpVersion);
        const wptlUrl = getWordPressTestLibraryBaseUrl(wpVersion);
        await Promise.all([
            downloadWordPress(wpUrl, inputs.dir, wpSemVer, inputs.cache),
            downloadTestLibrary(wptlUrl, inputs.dir, wpSemVer, inputs.cache),
        ]);

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
