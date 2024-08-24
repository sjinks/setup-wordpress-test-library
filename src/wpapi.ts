import { HttpClient } from '@actions/http-client';
import { sortVersions } from './utils';

interface Package {
    full: string;
    no_content: string;
    new_bundled: string;
    partial: boolean;
    rollback: boolean;
}

interface Offer {
    response: string;
    download: string;
    locale: string;
    packages: Package;
    current: string;
    version: string;
    php_version: string;
    mysql_version: string;
    new_bundled: string;
    partial_version: boolean;
    new_files?: boolean;
}

interface ApiResponse {
    offers: Offer[];
    translations: unknown[];
}

/**
 * Get the latest WordPress version.
 *
 * @async
 * @returns {Promise<string>} The latest WordPress version.
 */
export async function getLatestVersion(): Promise<string> {
    const client = new HttpClient();
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- http:// endpoint returns different results
    const json = await client.getJson<ApiResponse>('http://api.wordpress.org/core/version-check/1.7/');
    if (json.statusCode === 200 && json.result) {
        return json.result.offers[0].version;
    }

    throw new Error(`Failed to fetch WordPress versions: error ${json.statusCode}`);
}

/**
 * Get the latest version of a branch.
 *
 * @async
 * @param {string} prefix The branch prefix.
 * @returns {Promise<string>} The latest version of the branch.
 */
export async function getLatestBranchVersion(prefix: string): Promise<string> {
    const client = new HttpClient();
    const json = await client.getJson<ApiResponse>('https://api.wordpress.org/core/version-check/1.7/');

    if (json.statusCode === 200 && json.result) {
        const candidates = json.result.offers
            .filter((offer) => offer.version.startsWith(prefix))
            .map((offer) => offer.version);
        const sorted = sortVersions(candidates);
        return sorted[0];
    }

    throw new Error(`Failed to fetch WordPress versions: error ${json.statusCode}`);
}
