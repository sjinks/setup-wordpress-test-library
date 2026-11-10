/* eslint-disable sonarjs/no-os-command-from-path -- Subversion is an action dependency. */
import { test } from 'node:test';
import { deepEqual, equal, rejects } from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SVNClient } from '@taiyosen/easy-svn';

await test('nightly installation', async (t) => {
    for (const command of ['svn', 'svnadmin']) {
        try {
            execFileSync(command, ['--version', '--quiet'], { stdio: 'ignore' });
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                t.skip(`${command} is not available`);
                return;
            }

            throw error;
        }
    }

    const root = await mkdtemp(join(tmpdir(), 'wptl-nightly-'));
    t.after(async () => rm(root, { recursive: true, force: true }));
    const repository = join(root, 'repository');
    const repositoryUrl = pathToFileURL(repository).href;
    const source = join(root, 'source');
    const files = [
        ['src/wp-includes/version.php', 'wordpress/wp-includes/version.php'],
        ['tests/phpunit/includes/bootstrap.php', 'wordpress-tests-lib/includes/bootstrap.php'],
        ['tests/phpunit/data/fixture.txt', 'wordpress-tests-lib/data/fixture.txt'],
        ['wp-tests-config-sample.php', 'wordpress-tests-lib/wp-tests-config-sample.php'],
    ];

    await Promise.all(
        files.map(async ([file]) => {
            const path = join(source, 'trunk', file);
            await mkdir(join(path, '..'), { recursive: true });
            await writeFile(path, `revision 1: ${file}`);
        }),
    );

    execFileSync('svnadmin', ['create', repository]);
    execFileSync('svn', ['import', source, repositoryUrl, '-m', 'Initial revision']);

    let revisionOverride: string | undefined;
    let failInfo = false;
    let failExport = false;
    let infoCalls = 0;
    let exportCalls = 0;
    const upstream = 'https://develop.svn.wordpress.org/trunk';

    class LocalSVNClient {
        private readonly client = new SVNClient();

        public setConfig(config: { silent: boolean }): void {
            this.client.setConfig(config);
        }

        public async info(targets: string[], options: { showItem?: string }): Promise<string> {
            ++infoCalls;
            deepEqual(targets, [upstream]);
            deepEqual(options, { showItem: 'revision' });
            if (failInfo) {
                throw new Error('SVN unavailable');
            }

            if (revisionOverride !== undefined) {
                return revisionOverride;
            }

            const revision = await this.client.cmd('info', ['--show-item', 'revision', `${repositoryUrl}/trunk`]);
            // HEAD changes before any download, even removing the original path.
            execFileSync('svn', [
                'move',
                `${repositoryUrl}/trunk`,
                `${repositoryUrl}/moved-trunk`,
                '-m',
                'Advance HEAD',
            ]);

            return revision;
        }

        public async cmd(command: string, parameters: string[]): Promise<string> {
            ++exportCalls;
            equal(command, 'export');
            if (failExport) {
                throw new Error('Export failed');
            }

            return this.client.cmd(
                command,
                parameters.map((value) => value.replace(upstream, `${repositoryUrl}/trunk`)),
            );
        }
    }

    const mock = t.mock.module('@taiyosen/easy-svn', { namedExports: { SVNClient: LocalSVNClient } });
    t.after(() => mock.restore());

    const { downloadNightlyWordPress } = await import('../src/nightly.mjs');

    await t.test('exports all components at the selected revision even after HEAD moves', async () => {
        const destination = join(root, 'installed');
        await downloadNightlyWordPress(destination);
        equal(infoCalls, 1);
        equal(exportCalls, 4);
        await Promise.all(
            files.map(async ([sourceFile, installedFile]) => {
                equal(await readFile(join(destination, installedFile), 'utf8'), `revision 1: ${sourceFile}`);
            }),
        );
        await rejects(access(join(destination, 'wordpress', '.svn')));
        await rejects(access(join(destination, 'wordpress-tests-lib', 'includes', '.svn')));
    });

    await t.test('fails before downloading if revision discovery fails', async () => {
        failInfo = true;
        await rejects(downloadNightlyWordPress(join(root, 'failed')), /SVN unavailable/u);
        equal(exportCalls, 4);
        failInfo = false;
    });

    await t.test('rejects malformed revisions without downloading', async () => {
        for (const revision of ['', 'HEAD', '0', 'NaN', '65390\n65391']) {
            revisionOverride = revision;
            // eslint-disable-next-line no-await-in-loop
            await rejects(downloadNightlyWordPress(join(root, 'invalid')), /Invalid WordPress SVN revision/u);
        }

        equal(exportCalls, 4);
    });

    await t.test('propagates export failures without falling back to an unpinned download', async () => {
        revisionOverride = '1';
        failExport = true;
        await rejects(downloadNightlyWordPress(join(root, 'export-failed')), /Export failed/u);
    });
});
