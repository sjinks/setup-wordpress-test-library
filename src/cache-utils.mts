import { cp, lstat, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Copy a tool-cache directory so a later cache save does not archive a symlink. */
export async function copyCachedTool(source: string, destination: string): Promise<void> {
    await cp(source, destination, { recursive: true });
}

/** Reject missing, incomplete, or symlinked cache roots. */
export async function isUsableCache(directory: string, marker: string): Promise<boolean> {
    try {
        return (await lstat(directory)).isDirectory() && (await stat(join(directory, marker))).isFile();
    } catch {
        return false;
    }
}
