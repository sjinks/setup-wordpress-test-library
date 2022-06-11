import { sortVersions } from '../src/utils';

describe('sortVersions', () => {
    it('should sort versions correctly', () => {
        const input = ['5.9.3', '5', '5.8', '5.9', '5.9.10', '5.9.2', '6'];
        const expected = ['6', '5.9.10', '5.9.3', '5.9.2', '5.9', '5.8', '5'];
        const actual = sortVersions(input);
        expect(actual).toStrictEqual(expected);
    });
});
