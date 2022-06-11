import { getLatestBranchVersion, getLatestVersion } from './wpapi';

export function resolveWordPressVersion(version: string): Promise<string> {
    if (version === 'nightly' || version === 'trunk') {
        return Promise.resolve('nightly');
    }

    if (version === 'latest') {
        return getLatestVersion();
    }

    if (version.endsWith('.x')) {
        return getLatestBranchVersion(version.slice(0, -2));
    }

    return Promise.resolve(version);
}

export function getWordPressDownloadUrl(version: string): string {
    if (version === 'nightly') {
        return 'https://wordpress.org/nightly-builds/wordpress-latest.zip';
    }

    return `https://wordpress.org/wordpress-${version}.zip`;
}

export function getWordPressTestLibraryBaseUrl(version: string): string {
    const tag = version === 'nightly' ? 'trunk' : `tags/${version}`;
    return `https://develop.svn.wordpress.org/${tag}`;
}
