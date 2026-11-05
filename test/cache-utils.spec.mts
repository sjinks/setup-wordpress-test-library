/* eslint-disable sonarjs/no-os-command-from-path -- tar is a test dependency, as it is for the Actions cache */
import { test } from 'node:test';
import { equal } from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyCachedTool, isUsableCache } from '../src/cache-utils.mjs';

await test('tool-cache copies survive an archive restore on a fresh runner', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'wptl-cache-'));
    t.after(async () => rm(root, { recursive: true, force: true }));
    const source = join(root, 'tool-cache');
    const destination = join(root, 'wordpress');
    await mkdir(join(source, 'wp-includes'), { recursive: true });
    await writeFile(join(source, 'wp-includes/version.php'), 'version');
    await copyCachedTool(source, destination);
    equal((await lstat(destination)).isDirectory(), true);
    equal(await isUsableCache(destination, 'wp-includes/version.php'), true);

    const archive = join(root, 'cache.tar');
    execFileSync('tar', ['-cf', archive, '-C', root, 'wordpress']);
    await rm(source, { recursive: true });
    await rm(destination, { recursive: true });
    execFileSync('tar', ['-xf', archive, '-C', root]);
    equal(await isUsableCache(destination, 'wp-includes/version.php'), true);
    equal(await readFile(join(destination, 'wp-includes/version.php'), 'utf8'), 'version');
});

await test('rejects dangling symlinks and incomplete cache directories', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'wptl-cache-'));
    t.after(async () => rm(root, { recursive: true, force: true }));
    const destination = join(root, 'wordpress-tests-lib');
    await symlink(join(root, 'missing'), destination);
    equal(await isUsableCache(destination, 'wp-tests-config-sample.php'), false);
    await rm(destination);
    await mkdir(destination);
    equal(await isUsableCache(destination, 'wp-tests-config-sample.php'), false);
    await writeFile(join(destination, 'wp-tests-config-sample.php'), 'config');
    equal(await isUsableCache(destination, 'wp-tests-config-sample.php'), true);
    const alias = join(root, 'alias');
    await symlink(destination, alias, 'dir');
    equal(await isUsableCache(alias, 'wp-tests-config-sample.php'), false);
});
