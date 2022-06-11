import { stat } from 'node:fs/promises';
import { HttpClient } from '@actions/http-client';

export function sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => {
        const aSplit = a.split('.');
        const bSplit = b.split('.');
        for (let i = 0; i < Math.max(aSplit.length, bSplit.length); ++i) {
            const aPart = +(aSplit[i] || '0');
            const bPart = +(bSplit[i] || '0');
            if (aPart !== bPart) {
                return bPart - aPart;
            }
        }

        return 0;
    });
}

export async function isDir(path: string): Promise<boolean> {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function downloadAsText(url: string): Promise<string> {
    const client = new HttpClient('setup-wptl-action');
    const response = await client.get(url);
    if (response.message.statusCode === 200) {
        return response.readBody();
    }

    throw new Error(`Failed to download ${url}: error ${response.message.statusCode}`);
}

export function isGHES(): boolean {
    const ghUrl = new URL(process.env.GITHUB_SERVER_URL || 'https://github.com');
    return ghUrl.hostname.toLowerCase() !== 'github.com';
}
