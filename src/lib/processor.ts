import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { templates, type CodebaseTemplate } from '$lib/templates';

// ADD THIS:
import { logDebug } from '$lib/server/logger.js';

export type SaveMode = 'root' | 'global' | 'custom';

export interface ProcessConfig {
    sourceDir: string;
    saveMode: SaveMode;
    customPath?: string;
    templateIds: string[];
    maxChars: number;
    // NEW: Optional explicit list of files to process (overrides templates)
    selectedFiles?: string[];
    // NEW: Toggle for tree context
    includeIgnoredInTree?: boolean;
}

interface ProcessResult {
    success: boolean;
    message: string;
    outputPath: string;
    files: string[];
}

export interface DetectionResult {
    ids: string[];
    reasons: Record<string, string[]>; // templateId -> list of filenames that triggered it
    gitStatus: 'none' | 'clean' | 'ignored'; // 'none' = no .git, 'clean' = has .git but no ignore entry, 'ignored' = already configured
}

// Regex to find safe places to split code
const SAFE_SPLIT_REGEX = /\n(?=(function|class|export|interface|type|def|func|const|let|var|public|private|protected|struct|impl|package|import)\s)/g;

// --- CONSTANTS FOR STRICT DETECTION ---

// Extensions that are too common to act as proof of a specific framework
// UPDATED: Added .py, .php, .java, .rb, .go, .rs to prevent frameworks from stealing generic language attribution
const GENERIC_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.json', '.md', '.yaml', '.yml',
    '.py', '.php', '.java', '.rb', '.go', '.rs', '.c', '.cpp', '.h'
]);

// Triggers that are too common to prove a specific framework
const GENERIC_TRIGGERS = new Set([
    'package.json', 'README.md', '.gitignore', '.env', '.editorconfig', 'LICENSE', 'tsconfig.json',
    'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'
]);

const FRAMEWORK_DEPENDENCIES: Record<string, string[]> = {
    'react': ['javascript', 'typescript', 'html-css'],
    'nextjs': ['react', 'javascript', 'typescript', 'html-css'],
    'vuejs': ['javascript', 'typescript', 'html-css'],
    'nuxtjs': ['vuejs', 'javascript', 'typescript', 'html-css'],
    'sveltekit': ['javascript', 'typescript', 'html-css'],
    'angular': ['typescript', 'html-css'],
    'astro': ['javascript', 'typescript', 'html-css'],
    'remix': ['react', 'javascript', 'typescript', 'html-css'],
    'solidjs': ['javascript', 'typescript', 'html-css'],
    'qwik': ['javascript', 'typescript', 'html-css'],
    'laravel': ['php', 'html-css'],
    'django': ['python', 'html-css'],
    'flask': ['python', 'html-css'],
    'spring-boot': ['java'],
    'flutter': ['dart'],
    'rails': ['ruby', 'html-css']
};

// --- PUBLIC API ---

/**
 * 1. Detect Codebase
 * Returns detected IDs, the files that triggered them, and git status.
 */
export async function detectCodebase(sourceDir: string): Promise<DetectionResult> {
    // ADD THIS:
    logDebug(`Starting detection in: ${sourceDir}`);

    try {
        const detectedIds = new Set<string>();
        const reasons: Record<string, string[]> = {};
        let gitStatus: 'none' | 'clean' | 'ignored' = 'none';

        // 1. Scan environment
        // ADD THIS:
        logDebug('Reading root directory...');
        const rootFiles = await fs.readdir(sourceDir);

        // Check for git and specifically .gitignore status
        if (rootFiles.includes('.git')) {
            if (rootFiles.includes('.gitignore')) {
                try {
                    const gitIgnoreContent = await fs.readFile(path.join(sourceDir, '.gitignore'), 'utf-8');
                    if (gitIgnoreContent.includes('TXT-Forge')) {
                        gitStatus = 'ignored'; // Already has it
                    } else {
                        gitStatus = 'clean'; // Has .git, but needs update
                    }
                } catch (e) {
                    gitStatus = 'clean'; // Fallback
                }
            } else {
                gitStatus = 'clean'; // Has .git, needs .gitignore created
            }
        }

        const foundExtensions = await deepScanExtensions(sourceDir, 4);

        // 2. Iterate all templates
        for (const t of templates) {
            const foundTriggers: string[] = [];
            let strongEvidenceFound = false;

            // CHECK A: Unique Config Files (Triggers)
            for (const trigger of t.triggers) {
                if (GENERIC_TRIGGERS.has(trigger)) continue;

                if (trigger.startsWith('*')) {
                    const suffix = trigger.slice(1);
                    const matches = rootFiles.filter(f => f.endsWith(suffix));
                    if (matches.length > 0) {
                        foundTriggers.push(...matches);
                    }
                } else {
                    if (rootFiles.includes(trigger)) {
                        foundTriggers.push(trigger);
                    }
                }
            }

            if (foundTriggers.length > 0) {
                strongEvidenceFound = true;
            }

            // CHECK B: Unique File Extensions
            const isGenericLanguage = ['javascript', 'typescript', 'html-css', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby'].includes(t.id);

            if (!strongEvidenceFound) {
                const relevantExtensions = t.extensions.filter(ext => {
                    if (isGenericLanguage) return true;
                    return !GENERIC_EXTENSIONS.has(ext);
                });

                for (const ext of relevantExtensions) {
                    if (foundExtensions.has(ext)) {
                        strongEvidenceFound = true;
                        if (!foundTriggers.includes(`*${ext} files`)) foundTriggers.push(`*${ext} files`);
                    }
                }
            }

            if (strongEvidenceFound) {
                detectedIds.add(t.id);
                reasons[t.id] = foundTriggers;
            }
        }

        // 3. Dependency Inference
        detectedIds.forEach(id => {
            if (FRAMEWORK_DEPENDENCIES[id]) {
                FRAMEWORK_DEPENDENCIES[id].forEach(dep => {
                    if (!detectedIds.has(dep)) {
                        detectedIds.add(dep);
                        reasons[dep] = [`Implied by ${id}`];
                    }
                });
            }
        });

        // 4. Safety Fallback
        if (rootFiles.includes('package.json') && !Array.from(detectedIds).some(id => ['react', 'vuejs', 'sveltekit', 'nextjs', 'angular', 'solidjs', 'qwik', 'astro'].includes(id))) {
             if (foundExtensions.has('.ts')) { detectedIds.add('typescript'); reasons['typescript'] = ['Found .ts files']; }
             if (foundExtensions.has('.js')) { detectedIds.add('javascript'); reasons['javascript'] = ['Found .js files']; }
        }

        return {
            ids: Array.from(detectedIds),
            reasons,
            gitStatus // Return the granular status
        };
    } catch (e) {
        console.error("Detection failed", e);
        return { ids: [], reasons: {}, gitStatus: 'none' };
    }
}

// Import the tree helper
import { generateTreeString, type TreeNode, scanDirectory } from '$lib/tree';

/**
 * 2. Process Files
 */
export async function processFiles(config: ProcessConfig): Promise<ProcessResult> {
    try {
        const sourceRoot = path.resolve(config.sourceDir);
        const projectName = path.basename(sourceRoot);

        // --- DETERMINE FILES TO PROCESS (OFFLOADED LOGIC) ---

        let filesToProcess: string[] = [];
        let filesForTree: string[] = []; // Separate list for the visual tree

        // 1. Setup Ignores
        const ignorePatterns = new Set<string>(['.git', 'node_modules', 'TXT-Forge', '.txt-forge-vault']);
        const massiveFolders = new Set<string>(['node_modules', '.git', '.svelte-kit', '.next', 'dist', 'build', 'vendor']); // Explicit massive folders

        const activeTemplates = templates.filter(t => config.templateIds.includes(t.id));
        activeTemplates.forEach(t => t.ignores.forEach(ign => ignorePatterns.add(ign.replace(/\/$/, ''))));

        // 2. Determine Content Files
        if (config.selectedFiles && config.selectedFiles.length > 0) {
            // MODE A: Explicit Selection

            const explicitFiles = new Set<string>();
            for (const relPath of config.selectedFiles) {
                const fullPath = path.join(sourceRoot, relPath);
                try {
                    const stat = await fs.stat(fullPath);
                    if (stat.isDirectory()) {
                        const dirFiles = await scanFiles(sourceRoot, fullPath, [], Array.from(ignorePatterns));
                        dirFiles.forEach(f => explicitFiles.add(f));
                    } else if (stat.isFile()) {
                        explicitFiles.add(fullPath);
                    }
                } catch (e) { }
            }
            filesToProcess = Array.from(explicitFiles);
        } else {
             // MODE B: Template Fallback
             const validExtensions = new Set<string>();
             activeTemplates.forEach(t => t.extensions.forEach(ext => validExtensions.add(ext)));
             filesToProcess = await scanFiles(sourceRoot, sourceRoot, Array.from(validExtensions), Array.from(ignorePatterns));
        }

        // 3. Determine Tree Files (The Visual Map)
        if (config.includeIgnoredInTree) {
            // If toggle ON: We want a broader scan.
            // We scan everything, BUT we stop at massive folders.
            // We pass an EMPTY extension list (accept all extensions).
            // We pass a minimal ignore list (only massive folders).
            const massiveIgnores = Array.from(massiveFolders);
            filesForTree = await scanFiles(sourceRoot, sourceRoot, [], massiveIgnores);
        } else {
            // If toggle OFF: Tree matches content exactly.
            filesForTree = [...filesToProcess];
        }

        // Sort tree alphabetically for display
        filesForTree.sort();
        const sourceTreeContent = filesForTree.map(f => path.relative(sourceRoot, f)).join('\n');

        if (filesToProcess.length === 0) return { success: false, message: "No matching files found.", outputPath: '', files: [] };

        // --- PREPARE OUTPUT (Keep existing logic) ---

        let outputBaseDir = '';
        if (config.saveMode === 'root') outputBaseDir = path.join(sourceRoot, 'TXT-Forge');
        else if (config.saveMode === 'global') outputBaseDir = path.join(os.homedir(), '.txt-forge-vault', projectName);
        else if (config.saveMode === 'custom' && config.customPath) outputBaseDir = path.resolve(config.customPath);
        else throw new Error("Invalid save path configuration.");

        if (config.saveMode === 'root') await ensureGitIgnore(sourceRoot);

        const mergedDir = path.join(outputBaseDir, 'Merged');
        await cleanDirectory(mergedDir);

        // --- READ & MERGE (Keep existing logic) ---

        const fileMap: { original: string, relPath: string, content: string }[] = [];

        for (const filePath of filesToProcess) {
            try {
                // Size check for massive files check inside export
                const stats = await fs.stat(filePath);
                if (stats.size > 1024 * 1024 * 5) { // Skip > 5MB in content processing
                     console.warn(`Skipping huge file > 5MB: ${filePath}`);
                     continue;
                }

                const content = await fs.readFile(filePath, 'utf-8');
                const relPath = path.relative(sourceRoot, filePath);
                fileMap.push({ original: filePath, relPath, content });
            } catch (e) { }
        }

        // --- GENERATE FILES (Keep existing) ---

        const treeBody = sourceTreeContent.trim();
        const indentedBody = treeBody.split('\n').map(line => '│   ' + line).join('\n');
        const finalTreeContent = `repository/\n${indentedBody}`;

        await fs.writeFile(path.join(mergedDir, 'Source-Tree.txt'), finalTreeContent, 'utf-8');

        const generatedFiles = await mergeFiles(fileMap, mergedDir, config.maxChars);

        generatedFiles.unshift('Source-Tree.txt');

        return {
            success: true,
            message: "Processing Complete",
            outputPath: mergedDir,
            files: generatedFiles
        };
    } catch (error: any) {
        return { success: false, message: error.message || "Unknown Error", outputPath: '', files: [] };
    }
}

// --- INTERNAL HELPERS ---

async function ensureGitIgnore(rootDir: string) {
    try {
        const gitIgnorePath = path.join(rootDir, '.gitignore');
        let content = "";
        
        try {
            content = await fs.readFile(gitIgnorePath, 'utf-8');
        } catch (e) {
            // File doesn't exist, we will create it
            content = "";
        }

        if (!content.includes('TXT-Forge')) {
            const append = content.endsWith('\n') || content === "" ? "TXT-Forge/" : "\nTXT-Forge/";
            await fs.appendFile(gitIgnorePath, append, 'utf-8');
        }
    } catch (e) {
        console.warn("Could not update .gitignore", e);
    }
}

async function cleanDirectory(dir: string) {
    try {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {}
}

/**
 * Scans a few levels deep to find all active extensions in the project.
 * This allows us to detect "React" by finding .tsx files even if the config is weird.
 */
async function deepScanExtensions(dir: string, depth: number): Promise<Set<string>> {
    let extensions = new Set<string>();
    if (depth <= 0) return extensions;

    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of list) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === 'vendor') continue;

            if (entry.isDirectory()) {
                const subExts = await deepScanExtensions(path.join(dir, entry.name), depth - 1);
                subExts.forEach(e => extensions.add(e));
            } else {
                const ext = path.extname(entry.name);
                if (ext) extensions.add(ext);
            }
        }
    } catch (e) {
        // ADD THIS:
        logDebug(`Error scanning dir ${dir}:`, e);
    }

    return extensions;
}

async function scanFiles(rootDir: string, currentDir: string, extensions: string[], ignores: string[]): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of list) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath);

        // ... (Keep existing ignore logic) ...
        const pathParts = relPath.split(path.sep);
        const isIgnored = pathParts.some(part =>
            ignores.some(ign => {
                if (ign.startsWith('*')) return part.endsWith(ign.slice(1));
                return part === ign || part.toLowerCase() === ign.toLowerCase();
            })
        );
        if (isIgnored) continue;

        if (entry.isDirectory()) {
            results = results.concat(await scanFiles(rootDir, fullPath, extensions, ignores));
        } else {
            const ext = path.extname(entry.name);
            // UPDATED: If extensions list is empty, accept all (used for folder selection)
            if (extensions.length === 0 || extensions.includes(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

/**
 * BIN PACKING MERGE (Best Fit Decreasing)
 * Minimizes the number of output files by filling gaps intelligently.
 */
async function mergeFiles(
    files: { relPath: string, content: string }[],
    outputDir: string,
    maxChars: number
): Promise<string[]> {

    const createdFiles: string[] = [];
    let fileIndex = 1;

    // 1. Prepare Items with Headers (Calculate total size)
    interface ProcessItem {
        relPath: string;
        fullText: string;
        size: number;
        isMultipart: boolean;
    }

    const items: ProcessItem[] = [];
    const multipartItems: { relPath: string, content: string }[] = [];

    for (const file of files) {
        const header = `\n${'='.repeat(50)}\nFile: ${file.relPath}\n${'='.repeat(50)}\n\n`;
        const fullText = header + file.content + "\n\n";

        if (fullText.length > maxChars) {
            // Handle Huge files separately
            multipartItems.push(file);
        } else {
            items.push({
                relPath: file.relPath,
                fullText: fullText,
                size: fullText.length,
                isMultipart: false
            });
        }
    }

    // 2. Sort Standard Items (Largest to Smallest) for BFD Algorithm
    items.sort((a, b) => b.size - a.size);

    // 3. Bin Packing
    interface Bin {
        currentSize: number;
        items: ProcessItem[];
    }

    const bins: Bin[] = [];

    for (const item of items) {
        // Find the tightest bin that fits this item (Best Fit)
        let bestBinIndex = -1;
        let minRemainingSpace = Infinity;

        for (let i = 0; i < bins.length; i++) {
            const remaining = maxChars - bins[i].currentSize;
            if (remaining >= item.size) {
                if (remaining < minRemainingSpace) {
                    minRemainingSpace = remaining;
                    bestBinIndex = i;
                }
            }
        }

        if (bestBinIndex !== -1) {
            // Place in existing bin
            bins[bestBinIndex].items.push(item);
            bins[bestBinIndex].currentSize += item.size;
        } else {
            // Create new bin
            bins.push({
                currentSize: item.size,
                items: [item]
            });
        }
    }

    // 4. Process Multipart Files (They get their own unique bins/files)
    // We process these immediately to get them out of the way
    for (const file of multipartItems) {
        let remaining = file.content;
        let part = 1;
        const totalParts = Math.ceil(remaining.length / (maxChars - 500)); // 500 buffer for headers

        while (remaining.length > 0) {
            const header = `\n${'='.repeat(50)}\nFile: ${file.relPath} (Part ${part}/${totalParts})\n${'='.repeat(50)}\n\n`;
            const availableSpace = maxChars - header.length;

            // Unique ID for multiparts
            const filename = `Source-${fileIndex}.${part} (Multipart File).txt`;

            let contentToWrite = "";

            if (remaining.length <= availableSpace) {
                contentToWrite = header + remaining + "\n\n";
                remaining = "";
            } else {
                // Smart Split
                let splitIdx = -1;
                const searchWindow = remaining.substring(0, availableSpace);
                let match;
                SAFE_SPLIT_REGEX.lastIndex = 0;
                while ((match = SAFE_SPLIT_REGEX.exec(searchWindow)) !== null) {
                    splitIdx = match.index;
                }
                if (splitIdx === -1) splitIdx = searchWindow.lastIndexOf('\n');
                if (splitIdx === -1) splitIdx = availableSpace;
                contentToWrite = header + remaining.substring(0, splitIdx) + "\n\n";
                remaining = remaining.substring(splitIdx);
            }

            const indexHeader = "--- INDEX ---\n" + `${file.relPath} (Part ${part}/${totalParts})` + "\n" + "-".repeat(30) + "\n\n";
            await fs.writeFile(path.join(outputDir, filename), indexHeader + contentToWrite, 'utf-8');
            createdFiles.push(filename);
            part++;
        }
        fileIndex++;
    }

    // 5. Write Bins (Standard Files)
    for (const bin of bins) {
        const filename = `Source-${fileIndex} (${bin.items.length} Files).txt`;

        // Build Index
        const indexList = bin.items.map(i => i.relPath).join('\n');
        const indexHeader = "--- INDEX ---\n" + indexList + "\n" + "-".repeat(30) + "\n\n";

        // Build Body (Sort alphabetically inside the file for readability, or keep size order?
        // Typically alphabetical is better for reading context within a single file)
        bin.items.sort((a, b) => a.relPath.localeCompare(b.relPath));
        const body = bin.items.map(i => i.fullText).join('');

        await fs.writeFile(path.join(outputDir, filename), indexHeader + body, 'utf-8');
        createdFiles.push(filename);
        fileIndex++;
    }

    return createdFiles;
}
