import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { templates, type CodebaseTemplate } from '$lib/templates';

export type SaveMode = 'root' | 'global' | 'custom';

export interface ProcessConfig {
    sourceDir: string;
    saveMode: SaveMode;
    customPath?: string;
    templateIds: string[];
    maxChars: number;
    // NEW: Optional explicit list of files to process (overrides templates)
    selectedFiles?: string[];
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
    try {
        const detectedIds = new Set<string>();
        const reasons: Record<string, string[]> = {};
        let gitStatus: 'none' | 'clean' | 'ignored' = 'none';

        // 1. Scan environment
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
        // --- DETERMINE FILES TO PROCESS ---

        let filesToProcess: string[] = [];
        let sourceTreeContent = "";
        if (config.selectedFiles && config.selectedFiles.length > 0) {
            // MODE A: File Tree Selection (Explicit)
            // We use the list provided by the frontend directly.
            // The frontend sends RELATIVE paths.

            // 1. Verify existence and resolve absolute paths
            for (const relPath of config.selectedFiles) {
                const fullPath = path.join(sourceRoot, relPath);
                try {
                    const stat = await fs.stat(fullPath);
                    if (stat.isFile()) {
                        filesToProcess.push(fullPath);
                    }
                } catch (e) {
                    // File might have been deleted since scan
                }
            }

            // 2. Generate Source-Tree.txt content
            // We need to re-scan briefly or reconstruct the tree structure to print it nicely.
            // For performance, we re-scan but filter using the Set.
            const fullTree = await scanDirectory(sourceRoot, sourceRoot);
            sourceTreeContent = generateTreeString(fullTree, new Set(config.selectedFiles));
        } else {
            // MODE B: Template Detection (Legacy/Fallback)
            // ... existing logic ...
            const activeTemplates = templates.filter(t => config.templateIds.includes(t.id));
            if (activeTemplates.length === 0) throw new Error("No templates selected.");
            const validExtensions = new Set<string>();
            const ignorePatterns = new Set<string>(['.git', 'node_modules', 'TXT-Forge', '.txt-forge-vault']);
            activeTemplates.forEach(t => {
                t.extensions.forEach(ext => validExtensions.add(ext));
                t.ignores.forEach(ign => ignorePatterns.add(ign.replace(/\/$/, '')));
            });

            filesToProcess = await scanFiles(sourceRoot, sourceRoot, Array.from(validExtensions), Array.from(ignorePatterns));

            // Generate simple list for tree txt in this mode
            sourceTreeContent = filesToProcess.map(f => path.relative(sourceRoot, f)).join('\n');
        }

        if (filesToProcess.length === 0) return { success: false, message: "No matching files found.", outputPath: '', files: [] };

        // --- PREPARE OUTPUT ---

        let outputBaseDir = '';
        if (config.saveMode === 'root') outputBaseDir = path.join(sourceRoot, 'TXT-Forge');
        else if (config.saveMode === 'global') outputBaseDir = path.join(os.homedir(), '.txt-forge-vault', projectName);
        else if (config.saveMode === 'custom' && config.customPath) outputBaseDir = path.resolve(config.customPath);
        else throw new Error("Invalid save path configuration.");

        if (config.saveMode === 'root') {
            await ensureGitIgnore(sourceRoot);
        }

        const mergedDir = path.join(outputBaseDir, 'Merged');
        await cleanDirectory(mergedDir);

        // --- READ & MERGE ---

        const fileMap: { original: string, relPath: string, content: string }[] = [];

        for (const filePath of filesToProcess) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const relPath = path.relative(sourceRoot, filePath);
                fileMap.push({ original: filePath, relPath, content });
            } catch (e) {
                console.warn(`Skipping binary or unreadable file: ${filePath}`);
            }
        }

        // --- GENERATE FILES ---

        // 1. Write Source-Tree.txt
        // WRAPPER UPDATE: We wrap the tree in a "repository/" root folder string.
        const treeBody = sourceTreeContent.trim();
        // Indent the generated body to look like it's inside the repository folder
        const indentedBody = treeBody.split('\n').map(line => '│   ' + line).join('\n');
        const finalTreeContent = `repository/\n${indentedBody}`;

        await fs.writeFile(path.join(mergedDir, 'Source-Tree.txt'), finalTreeContent, 'utf-8');

        // 2. Merge Content
        const generatedFiles = await mergeFiles(fileMap, mergedDir, config.maxChars);

        // Add Source-Tree.txt to the list of generated files for the UI return
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
    } catch (e) { /* ignore access errors */ }

    return extensions;
}

async function scanFiles(rootDir: string, currentDir: string, extensions: string[], ignores: string[]): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of list) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath);

        // Check Ignores (Simple match against parts of the path)
        // Logic: If any part of the path matches an ignore pattern
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
            if (extensions.includes(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

async function mergeFiles(
    files: { relPath: string, content: string }[],
    outputDir: string,
    maxChars: number
): Promise<string[]> {

    const createdFiles: string[] = [];
    let buffer = "";
    let bufferIndex: string[] = [];
    let bufferFileCount = 0; // NEW: Track number of files in buffer
    let fileIndex = 1;

    // Flush function for STANDARD files

    const flushBuffer = async () => {
        if (!buffer) return;
        const indexHeader = "--- INDEX ---\n" + bufferIndex.join('\n') + "\n" + "-".repeat(30) + "\n\n";

        // FORMAT: Source-{Index} ({Count} Files).txt
        const filename = `Source-${fileIndex} (${bufferFileCount} Files).txt`;

        await fs.writeFile(path.join(outputDir, filename), indexHeader + buffer, 'utf-8');
        createdFiles.push(filename);

        // Reset
        buffer = "";
        bufferIndex = [];
        bufferFileCount = 0;
        fileIndex++;
    };

    for (const file of files) {
        const fileHeader = `\n${'='.repeat(50)}\nFile: ${file.relPath}\n${'='.repeat(50)}\n\n`;
        const fullEntry = fileHeader + file.content + "\n\n";

        // --- CASE 1: HUGE FILE (MULTIPART) ---
        if (fullEntry.length > maxChars) {
            // 1. Flush whatever normal files we had in the buffer first
            await flushBuffer();
            // 2. Process this file strictly as a Multipart set
            // "Multipart files only contain one file"
            let remaining = file.content;
            let part = 1;
            const totalParts = Math.ceil(remaining.length / (maxChars - 500));
            while (remaining.length > 0) {
                const header = `\n${'='.repeat(50)}\nFile: ${file.relPath} (Part ${part}/${totalParts})\n${'='.repeat(50)}\n\n`;
                const availableSpace = maxChars - header.length;

                // FORMAT: Source-{Index}.{Part} (Multipart File).txt
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
            // Increment master index after finishing the multipart file
            fileIndex++;
            continue;
        }

        // --- CASE 2: STANDARD APPEND ---
        if ((buffer.length + fullEntry.length) > maxChars) {
            await flushBuffer();
        }

        buffer += fullEntry;
        bufferIndex.push(file.relPath);
        bufferFileCount++;
    }

    await flushBuffer();
    return createdFiles;
}
