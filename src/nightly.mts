import { join } from 'node:path';
import { info } from '@actions/core';
import { mkdirP } from '@actions/io';
import { SVNClient } from '@taiyosen/easy-svn';
import { getWordPressTestLibraryBaseUrl } from './wputils.mjs';

/** Install core and its PHPUnit library from one immutable development revision. */
export async function downloadNightlyWordPress(directory: string): Promise<void> {
    const url = getWordPressTestLibraryBaseUrl('nightly');
    const client = new SVNClient();
    client.setConfig({ silent: true });
    const revision = (await client.info([url], { showItem: 'revision' })).trim();
    if (!/^[1-9]\d*$/u.test(revision)) {
        throw new Error(`Invalid WordPress SVN revision: ${revision}`);
    }

    info(`📥 Downloading WordPress and Test Library at SVN revision ${revision}…`);
    await mkdirP(join(directory, 'wordpress-tests-lib'));
    await Promise.all(
        [
            ['src', 'wordpress'],
            ['tests/phpunit/includes', 'wordpress-tests-lib/includes'],
            ['tests/phpunit/data', 'wordpress-tests-lib/data'],
            ['wp-tests-config-sample.php', 'wordpress-tests-lib/wp-tests-config-sample.php'],
        ].map(async ([source, destination]) => {
            // Each client owns its command output; concurrent commands must not share one.
            const exporter = new SVNClient();
            exporter.setConfig({ silent: true });
            await exporter.cmd('export', [
                '--revision',
                revision,
                '--ignore-externals',
                `${url}/${source}@${revision}`,
                join(directory, destination),
            ]);
        }),
    );
}
