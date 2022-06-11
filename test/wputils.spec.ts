import { getLatestBranchVersion, getLatestVersion } from '../src/wpapi';
import { resolveWordPressVersion } from '../src/wputils';

jest.mock('../src/wpapi.ts');

const mocked_getLatestVersion = getLatestVersion as jest.Mock;
const mocked_getLatestBranchVersion = getLatestBranchVersion as jest.Mock;

describe('resolveWordPressVersion', () => {
    mocked_getLatestVersion.mockResolvedValue('9.9.9');
    mocked_getLatestBranchVersion.mockImplementation((version) => {
        switch (version) {
            case '5':
                return Promise.resolve('5.9.9');
            case '5.5':
                return Promise.resolve('5.5.9');
            default:
                return Promise.reject(new Error('This should not happen'));
        }
    });

    test.each([
        ['latest', '9.9.9'],
        ['5.x', '5.9.9'],
        ['5.5.x', '5.5.9'],
        ['5.9.9', '5.9.9'],
    ])('should resolve %s to %s', (version, expected) =>
        expect(resolveWordPressVersion(version)).resolves.toBe(expected),
    );
});
