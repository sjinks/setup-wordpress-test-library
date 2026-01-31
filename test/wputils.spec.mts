/* eslint-disable no-await-in-loop */
import { it, test } from 'node:test';
import { equal } from 'node:assert/strict';

void test('resolveWordPressVersion', async (t) => {
    const mock = t.mock.module('../src/wpapi.mjs', {
        cache: true,
        namedExports: {
            getLatestVersion: (): Promise<string> => Promise.resolve('9.9.9'),
            getLatestBranchVersion: (version: string): Promise<string> => {
                switch (version) {
                    case '5':
                        return Promise.resolve('5.9.9');
                    case '5.5':
                        return Promise.resolve('5.5.9');
                    default:
                        return Promise.reject(new Error('This should not happen'));
                }
            },
        },
    });

    const { resolveWordPressVersion } = await import('../src/wputils.mjs');

    for (const [version, expected] of [
        ['latest', '9.9.9'],
        ['5.x', '5.9.9'],
        ['5.5.x', '5.5.9'],
        ['5.9.9', '5.9.9'],
    ]) {
        await it(`should resolve ${version} to ${expected}`, async () => {
            const actual = await resolveWordPressVersion(version);
            equal(actual, expected);
        });
    }

    mock.restore();
});
