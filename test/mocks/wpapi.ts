import '../../src/wpapi';

require.cache[require.resolve('../../src/wpapi')]!.exports = {
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
};
