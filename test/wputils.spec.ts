/* eslint-disable no-await-in-loop */
import './mocks/wpapi';

import { describe, it } from 'node:test';
import { equal } from 'node:assert/strict';
import { resolveWordPressVersion } from '../src/wputils';

void describe('resolveWordPressVersion', async () => {
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
});
