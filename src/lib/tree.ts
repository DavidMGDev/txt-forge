import fs from 'fs/promises';
import path from 'path';

// ADD THIS:
import { logDebug } from '$lib/server/logger.js';

export interface TreeNode {
    name: string;
    path: string; // Relative path from root
    type: 'file' | 'folder';
    children?: TreeNode[];
    isIgnored: boolean; // True if matched by .gitignore or system hidden
    // ADD THIS:
    isMedia: boolean;
    depth: number;
}

const SYSTEM_HIDDEN = [
    '.git',
    '.DS_Store',
    'Thumbs.db',
    'node_modules',
    '.svelte-kit',
    '.txt-forge-vault',
    'TXT-Forge',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb'
];

// ADD THIS LIST:

const MEDIA_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
    '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.avi',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.ttf', '.otf', '.woff', '.woff2', '.eot'
]);

/**
 * specific ignore logic for the tree view (lighter than the full processor)
 */
function isSystemIgnored(name: string): boolean {
    return SYSTEM_HIDDEN.includes(name) || name.startsWith('.');
}

export async function scanDirectory(
    rootDir: string,
    currentDir: string,
    depth: number = 0,
    additionalIgnores: string[] = [] // <--- NEW PARAMETER
): Promise<TreeNode[]> {
    // ADD THIS LOG:
    logDebug(`Scanning directory: ${currentDir}`);

    const nodes: TreeNode[] = [];

    let entries: import('fs').Dirent[] = [];
    try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (e) {
        return []; // identifying access errors
    }

    // Merge passed ignores with local .gitignore
    // We pass additionalIgnores recursively
    const activeIgnores = [...additionalIgnores];
    const gitIgnorePath = path.join(currentDir, '.gitignore');
    try {
        const gitIgnoreContent = await fs.readFile(gitIgnorePath, 'utf-8');
        gitIgnoreContent.split('\n').forEach(line => {
            const l = line.trim();
            if (l && !l.startsWith('#')) activeIgnores.push(l);
        });
    } catch (e) { /* No gitignore here */ }

    // Sort: Folders first, then files
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath);

        // Normalize path to forward slashes for consistent gitignore comparison (Fixes Windows issues)
        const normalizedRelPath = relPath.split(path.sep).join('/');
        const isDirectory = entry.isDirectory();

        // Check simple ignore logic (System files)
        let isIgnored = isSystemIgnored(entry.name);

        // Check against accumulated patterns (Strict Git Logic)
        if (!isIgnored) {
             isIgnored = activeIgnores.some(pattern => {
                let p = pattern.trim();
                if (!p || p.startsWith('#')) return false;

                // 0. Handle Negation (Safety check: don't let ! patterns trigger ignores)
                if (p.startsWith('!')) return false;

                // Normalize pattern slashes
                p = p.replace(/\\/g, '/');

                // Handle directory-specific patterns (ending in /)
                const isDirPattern = p.endsWith('/');
                if (isDirPattern) {
                    p = p.slice(0, -1);
                    if (!isDirectory) return false; // Pattern expects dir, entry is file
                }

                // 1. Wildcards (e.g. *.log) - Simple suffix match
                if (p.startsWith('*')) {
                    return entry.name.endsWith(p.slice(1));
                }

                // 2. Rooted Paths (e.g. /node_modules) - Matches from root of scan
                if (p.startsWith('/')) {
                    const clean = p.slice(1);
                    return normalizedRelPath === clean || normalizedRelPath.startsWith(clean + '/');
                }

                // 3. Standard Name Match (e.g. "node_modules" or "dist")
                // Matches if the file/folder name is exactly the pattern
                if (!p.includes('/')) {
                    return entry.name === p;
                }

                // 4. Relative Path Match (e.g. "src/lib")
                // Matches if the full relative path starts with or equals the pattern
                return normalizedRelPath === p || normalizedRelPath.startsWith(p + '/');
             });
        }

        // --- DETECT MEDIA ---

        const ext = path.extname(entry.name).toLowerCase();

        const isMedia = !isDirectory && MEDIA_EXTENSIONS.has(ext);

        // --------------------

        const node: TreeNode = {
            name: entry.name,
            path: relPath, // Keep original OS-specific path for file operations
            type: isDirectory ? 'folder' : 'file',
            isIgnored: isIgnored,
            isMedia: isMedia, // <--- SET PROPERTY
            depth: depth
        };

        if (isDirectory) {
            // Recursively scan
            // Pass the ORIGINAL additionalIgnores down, not the accumulated local ones
            // (Logic: local .gitignores only apply to that folder and subfolders, but template ignores apply globally)
            node.children = await scanDirectory(rootDir, fullPath, depth + 1, additionalIgnores);
        }

        nodes.push(node);
    }

    return nodes;
}

/**
 * Generates a visual tree string for the Source-Tree.txt file
 */
export function generateTreeString(nodes: TreeNode[], selectedPaths: Set<string>, prefix = ''): string {
    let output = '';

    // Filter nodes that are effectively enabled
    // A node is visible if it is in selectedPaths OR if it's a folder that contains selected paths
    // However, for Source-Tree.txt, we usually just want to show exactly what is enabled.

    const validNodes = nodes.filter(n => selectedPaths.has(n.path));

    for (let i = 0; i < validNodes.length; i++) {
        const node = validNodes[i];
        const isLast = i === validNodes.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        output += prefix + connector + node.name + (node.type === 'folder' ? '/' : '') + '\n';
        if (node.children && node.children.length > 0) {
            output += generateTreeString(node.children, selectedPaths, prefix + childPrefix);
        }
    }
    return output;
}
