import { stat } from 'node:fs/promises';
import { HttpClient } from '@actions/http-client';

/**
 * Sort an array of version strings in descending order.
 *
 * @param {string[]} versions -The array of version strings to sort.
 * @returns {string[]} The sorted array of version strings.
 */
export function sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => {
        const aSplit = a.split('.');
        const bSplit = b.split('.');
        for (let i = 0; i < Math.max(aSplit.length, bSplit.length); ++i) {
            const aPart = Number(aSplit[i] || '0');
            const bPart = Number(bSplit[i] || '0');
            if (aPart !== bPart) {
                return bPart - aPart;
            }
        }

        return 0;
    });
}

/**
 * Check if a given path is a directory.
 *
 * @async
 * @param {string} path The path to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the path is a directory, false otherwise.
 */
export async function isDir(path: string): Promise<boolean> {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Download the content of a URL as a text string.
 *
 * @async
 * @param {string} url The URL to download from.
 * @returns {Promise<string>} A promise that resolves to the downloaded text.
 * @throws {Error} If the status code of the response is not 200.
 */
export async function downloadAsText(url: string): Promise<string> {
    const client = new HttpClient('setup-wptl-action', undefined, { allowRetries: true, maxRetries: 3 });
    const response = await client.get(url);
    if (response.message.statusCode === 200) {
        return response.readBody();
    }

    throw new Error(`Failed to download ${url}: error ${response.message.statusCode}`);
}

/**
 * Check if the GitHub server URL is not 'github.com', indicating it's a GitHub Enterprise Server (GHES).
 *
 * @returns {boolean} True if the GitHub server URL is not 'github.com', false otherwise.
 */
export function isGHES(): boolean {
    const url = process.env.GITHUB_SERVER_URL;
    if (!url) {
        return false;
    }

    const ghUrl = new URL(url);
    return ghUrl.hostname.toLowerCase() !== 'github.com';
}
