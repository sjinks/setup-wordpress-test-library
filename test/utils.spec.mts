import { describe, it } from 'node:test';
import { deepEqual } from 'node:assert/strict';
import { sortVersions } from '../src/utils.mjs';

await describe('sortVersions', async () => {
    await it('should sort versions correctly', () => {
        const input = ['5.9.3', '5', '5.8', '5.9', '5.9.10', '5.9.2', '6'];
        const expected = ['6', '5.9.10', '5.9.3', '5.9.2', '5.9', '5.8', '5'];
        const actual = sortVersions(input);
        deepEqual(actual, expected);
    });
});
