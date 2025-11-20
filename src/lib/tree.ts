import fs from 'fs/promises';
import path from 'path';

export interface TreeNode {
    name: string;
    path: string; // Relative path from root
    type: 'file' | 'folder';
    children?: TreeNode[];
    isIgnored: boolean; // True if matched by .gitignore or system hidden
    depth: number;
}

const SYSTEM_HIDDEN = ['.git', '.DS_Store', 'Thumbs.db', 'node_modules', '.svelte-kit', '.txt-forge-vault', 'TXT-Forge'];

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
    ignorePatterns: string[] = []
): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    let entries: import('fs').Dirent[] = [];
    try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (e) {
        return []; // identifying access errors
    }

    // Try to read .gitignore in this directory to append to patterns
    const localIgnores = [...ignorePatterns];
    const gitIgnorePath = path.join(currentDir, '.gitignore');
    try {
        const gitIgnoreContent = await fs.readFile(gitIgnorePath, 'utf-8');
        gitIgnoreContent.split('\n').forEach(line => {
            const l = line.trim();
            if (l && !l.startsWith('#')) localIgnores.push(l);
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

        // Check simple ignore logic
        // Note: This is a simplified checker. Real gitignore logic is complex.
        // We check if the name or path matches known system ignores or simple patterns.
        let isIgnored = isSystemIgnored(entry.name);

        // Check against accumulated patterns (Strict match)
        if (!isIgnored) {
             isIgnored = localIgnores.some(pattern => {
                const p = pattern.trim();
                if (!p || p.startsWith('#')) return false;

                // 1. Handle Wildcards (Simple end-match for extensions like *.log)
                if (p.startsWith('*')) {
                    return entry.name.endsWith(p.slice(1));
                }

                // 2. Handle Rooted patterns (e.g. /node_modules)
                if (p.startsWith('/')) {
                    const clean = p.slice(1).replace(/\/$/, '');
                    // Match exactly against the relative path from the scan root
                    return relPath === clean || relPath.startsWith(clean + path.sep);
                }

                // 3. Handle Standard patterns (e.g. node_modules, dist)
                // These should match if the FILE matches, or if it is INSIDE a matching folder
                const clean = p.replace(/\/$/, '');

                // Exact name match (e.g. file is named "dist")
                if (entry.name === clean) return true;

                // Path segment match (e.g. file is inside "dist/output.txt")
                // We split by separator to ensure we don't match "distinction" with "dist"
                const segments = relPath.split(path.sep);
                return segments.includes(clean);
             });
        }

        const node: TreeNode = {
            name: entry.name,
            path: relPath,
            type: entry.isDirectory() ? 'folder' : 'file',
            isIgnored: isIgnored,
            depth: depth
        };

        if (entry.isDirectory()) {
            // Recursively scan
            // We scan everything, but UI determines interactivity based on depth
            node.children = await scanDirectory(rootDir, fullPath, depth + 1, localIgnores);
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
