import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { templates, type CodebaseTemplate } from '$lib/templates';

// ADD THIS:
import { logDebug } from '$lib/server/logger.js';

// --- ADD THIS CONSTANT ---

const BINARY_EXTENSIONS = new Set([
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff', '.heic',
    // Fonts
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    // Audio/Video
    '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.avi', '.mkv',
    // 3D Models (Issue #3 Fix)
    '.fbx', '.obj', '.blend', '.glb', '.gltf', '.3ds',
    // Archives/Binaries
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib', '.bin', '.apk', '.aab',
    // Android Specific
    '.keystore', '.jks'
]);

export type SaveMode = 'root' | 'global' | 'custom';

// --- HELPER FUNCTIONS ---

async function analyzeMaven(dir: string, ids: Set<string>, reasons: Record<string, string[]>) {
    try {
        const content = await fs.readFile(path.join(dir, 'pom.xml'), 'utf-8');

        // Check Spring Boot
        if (content.includes('spring-boot-starter')) {
            ids.add('spring-boot');
            reasons['spring-boot'] = ['Found spring-boot-starter in pom.xml'];
            ids.add('java');
        }

        // Check Kotlin
        if (content.includes('kotlin-stdlib')) {
            ids.add('kotlin');
            reasons['kotlin'] = ['Found kotlin-stdlib in pom.xml'];
        } else {
            ids.add('java'); // Default to Java if no Kotlin explicitly defined
        }
    } catch (e) {}
}

async function analyzeGradle(dir: string, ids: Set<string>, reasons: Record<string, string[]>) {
    try {
        const filename = (await fs.readdir(dir)).find(f => f.startsWith('build.gradle'));
        if (!filename) return;
        const content = await fs.readFile(path.join(dir, filename), 'utf-8');

        // Check Android
        if (content.includes('com.android.application') || content.includes('com.android.library')) {
            ids.add('android');
            reasons['android'] = ['Found Android plugin in gradle'];
        }

        // Check Spring
        if (content.includes('org.springframework.boot')) {
            ids.add('spring-boot');
            reasons['spring-boot'] = ['Found Spring Boot plugin'];
        }

        // Check Kotlin
        if (content.includes('kotlin("jvm")') || content.includes('kotlin-stdlib')) {
            ids.add('kotlin');
            reasons['kotlin'] = ['Found Kotlin plugin'];
        } else {
             // If strictly Android, it might be Java or Kotlin.
             // We let extension scanner confirm Java if Kotlin isn't explicit here.
        }
    } catch (e) {}
}

async function analyzeNode(dir: string, ids: Set<string>, reasons: Record<string, string[]>) {
    try {
        const content = await fs.readFile(path.join(dir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [key, _] of Object.entries(deps)) {
             const tmpl = templates.find(t => t.id === key); // e.g. 'react', 'vue', 'express'
             if (tmpl) {
                 ids.add(tmpl.id);
                 reasons[tmpl.id] = [`Dependency: ${key}`];
             }

             // Manual mappings
             if (key.includes('react-scripts')) ids.add('react');
             if (key.includes('next')) ids.add('nextjs');
        }
    } catch (e) {}
}

export interface ProcessConfig {
    sourceDir: string;
    saveMode: SaveMode;
    customPath?: string;
    templateIds: string[];
    maxChars: number;
    selectedFiles?: string[];
    // UPDATED: Inverted Logic
    hideIgnoredInTree?: boolean;
}

interface ProcessResult {
    success: boolean;
    message: string;
    outputPath: string;
    files: string[];
    gitIgnoreModified?: boolean; // <--- NEW FIELD
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
/**

 * 1. Detect Codebase (Content-Aware Mode)

 */

export async function detectCodebase(sourceDir: string): Promise<DetectionResult> {

    logDebug(`Starting detection in: ${sourceDir}`);



    try {

        const detectedIds = new Set<string>();

        const reasons: Record<string, string[]> = {};

        let gitStatus: 'none' | 'clean' | 'ignored' = 'none';



        // 1. Scan root files

        const rootFiles = await fs.readdir(sourceDir);



        // Check .gitignore status

        if (rootFiles.includes('.git')) {

            gitStatus = 'clean';

            if (rootFiles.includes('.gitignore')) {

                try {

                    const content = await fs.readFile(path.join(sourceDir, '.gitignore'), 'utf-8');

                    if (content.includes('TXT-Forge')) gitStatus = 'ignored';

                } catch (e) {}

            }

        }



        // 2. PRE-ANALYSIS: Check Package Managers (The Source of Truth)

        let isManagedProject = false;



        // --- A. Maven (Java/Spring/Kotlin) ---

        if (rootFiles.includes('pom.xml')) {

            isManagedProject = true;

            try {

                const pomContent = await fs.readFile(path.join(sourceDir, 'pom.xml'), 'utf-8');



                // Check for Spring Boot

                if (pomContent.includes('spring-boot') || pomContent.includes('springframework')) {

                    detectedIds.add('spring-boot');

                    reasons['spring-boot'] = ['Found Spring dependencies in pom.xml'];

                    detectedIds.add('java'); // Spring implies Java usually

                }



                // Check for Kotlin

                if (pomContent.includes('kotlin-stdlib') || pomContent.includes('kotlin-maven-plugin')) {

                    detectedIds.add('kotlin');

                    reasons['kotlin'] = ['Found Kotlin dependencies in pom.xml'];

                } else {

                    detectedIds.add('java');

                    reasons['java'] = ['Found pom.xml (Java Project)'];

                }

            } catch (e) { console.error("Error reading pom.xml", e); }

        }



        // --- B. Gradle (Android/Java/Spring) ---

        const gradleFile = rootFiles.find(f => f === 'build.gradle' || f === 'build.gradle.kts');

        if (gradleFile) {

            isManagedProject = true;

            try {

                const gradleContent = await fs.readFile(path.join(sourceDir, gradleFile), 'utf-8');



                if (gradleContent.includes('com.android.application') || gradleContent.includes('com.android.library')) {

                    detectedIds.add('android');

                    reasons['android'] = ['Found Android plugin in gradle'];

                }



                if (gradleContent.includes('org.springframework.boot')) {

                    detectedIds.add('spring-boot');

                    reasons['spring-boot'] = ['Found Spring Boot plugin'];

                }



                if (gradleContent.includes('kotlin')) {

                    detectedIds.add('kotlin');

                    reasons['kotlin'] = ['Found Kotlin plugin'];

                }

            } catch (e) {}

        }



        // --- C. Node (JS/TS Frameworks) ---

        if (rootFiles.includes('package.json')) {

            isManagedProject = true;

            try {

                const pkgContent = await fs.readFile(path.join(sourceDir, 'package.json'), 'utf-8');

                const pkg = JSON.parse(pkgContent);

                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };



                // STRICT: Use the new 'packageMatch' property from templates

                for (const t of templates) {

                    if (t.packageMatch && t.packageMatch.length > 0) {

                        const match = t.packageMatch.find(p => allDeps[p]);

                        if (match) {

                            detectedIds.add(t.id);

                            reasons[t.id] = [`Dependency: ${match}`];

                        }

                    }

                }



                // Explicitly detect JS/TS based on deps/files if not already added

                if (allDeps['typescript']) {

                    detectedIds.add('typescript');

                    reasons['typescript'] = ['Found typescript dependency'];

                } else {

                    // If package.json exists but no typescript, likely JS

                    if (!detectedIds.has('typescript')) {

                        detectedIds.add('javascript');

                        reasons['javascript'] = ['Found package.json (Node Project)'];

                    }

                }

            } catch (e) {

                console.error("Error parsing package.json", e);

            }

        }



        // --- D. PHP Composer (Laravel/Symfony/etc) ---

        if (rootFiles.includes('composer.json')) {

            isManagedProject = true;

            try {

                const composerContent = await fs.readFile(path.join(sourceDir, 'composer.json'), 'utf-8');

                const composer = JSON.parse(composerContent);

                const allDeps = { ...composer.require, ...composer['require-dev'] };



                // STRICT: Check packageMatch against composer dependencies

                for (const t of templates) {

                    if (t.packageMatch && t.packageMatch.length > 0) {

                        const match = t.packageMatch.find(p => allDeps[p]);

                        if (match) {

                            detectedIds.add(t.id);

                            reasons[t.id] = [`Composer Dependency: ${match}`];

                        }

                    }

                }



                // Detect PHP Language explicitly if composer exists

                if (!detectedIds.has('php')) {

                    detectedIds.add('php');

                    reasons['php'] = ['Found composer.json'];

                }



            } catch (e) {

                console.error("Error parsing composer.json", e);

            }

        }



        // 3. Deep Scan for Utilities and Base Languages (Always run this)

        // Even if it is a Node project, we want to know if HTML/CSS/SQL/Shell exists.

        const foundExtensions = await deepScanExtensions(sourceDir, 3);



        if (rootFiles.includes('Dockerfile') || rootFiles.includes('docker-compose.yml')) {

            detectedIds.add('docker');

            reasons['docker'] = ['Docker config found'];

        }



        if (foundExtensions.has('.sql')) {

            detectedIds.add('sql');

            reasons['sql'] = ['SQL files found'];

        }



        if (foundExtensions.has('.sh')) {

            detectedIds.add('bash-shell');

            reasons['bash-shell'] = ['Shell scripts found'];

        }



        // Always check for HTML/CSS unless strict backend? 

        // It's safer to just detect them if files exist.

        if (foundExtensions.has('.html') || foundExtensions.has('.css')) {

            detectedIds.add('html-css');

            reasons['html-css'] = ['HTML/CSS files found'];

        }



        // 4. Fallback: File Trigger Detection

        // This catches frameworks that DON'T rely on package managers (e.g. pure Python/Go/Rust)

        // OR if we failed to identify a managed project context.

        

        for (const t of templates) {

            if (detectedIds.has(t.id)) continue; // Already found



            // Skip generic languages if we already identified the major platform

            if (isManagedProject) {

                // If we found package.json, don't guess generic JS/TS/Java again based on loose files

                if (['java', 'kotlin', 'android', 'javascript', 'typescript', 'react', 'vuejs', 'angular'].includes(t.id)) continue;

            }



            // Check Triggers

            const triggerMatch = t.triggers.some(trig => {

                 if (trig.startsWith('*')) {

                     // Suffix check (e.g. *.go) - verify against root files

                     return rootFiles.some(f => f.endsWith(trig.slice(1)));

                 }

                 return rootFiles.includes(trig);

            });



            if (triggerMatch) {

                detectedIds.add(t.id);

                reasons[t.id] = ['File trigger detected'];

            }

        }



        return {

            ids: Array.from(detectedIds),

            reasons,

            gitStatus

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

        // UPDATED: Added '*.uid' to exclude Godot uid files
        const ignorePatterns = new Set<string>(['.git', 'node_modules', '.godot', 'TXT-Forge', '.txt-forge-vault', '*.import', '*.uid']);

        // ADDED: '.godot' to massive folders list
        const massiveFolders = new Set<string>(['node_modules', '.git', '.godot', '.svelte-kit', '.next', 'dist', 'build', 'vendor']); // Explicit massive folders

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
                    // SECURITY CHECK: Never process binary/media files for content
                    const ext = path.extname(fullPath).toLowerCase();
                    if (BINARY_EXTENSIONS.has(ext)) continue;

                    if (stat.isDirectory()) {
                        // scanFiles already handles BINARY_EXTENSIONS exclusion by default (includeBinaries=false)
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
        if (!config.hideIgnoredInTree) {
            // If "Hide" is FALSE (Default): We want the broad scan (show context).
            // UPDATED: Pass 'true' for includeBinaries so .png, .wav etc appear in the tree map
            const massiveIgnores = Array.from(massiveFolders);
            // We also ensure *.import is in massiveIgnores logic if not already implicitly handled,
            // but better to concat the global ignorePatterns to be safe, or just rely on the fact that
            // scanFiles checks ignores.
            // To be safe for .import and .uid files in the tree, we add them to this specific call's ignore list:
            massiveIgnores.push('*.import');
            massiveIgnores.push('*.uid');

            filesForTree = await scanFiles(sourceRoot, sourceRoot, [], massiveIgnores, true);
        } else {
            // If "Hide" is TRUE: Tree matches content exactly (clean tree).
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

        let gitIgnoreModified = false;

        if (config.saveMode === 'root') {

            gitIgnoreModified = await ensureGitIgnore(sourceRoot);

        }

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
            files: generatedFiles,
            gitIgnoreModified // <--- Pass status
        };
    } catch (error: any) {
        return { success: false, message: error.message || "Unknown Error", outputPath: '', files: [] };
    }
}

// --- INTERNAL HELPERS ---

async function ensureGitIgnore(rootDir: string): Promise<boolean> {
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
            return true; // <--- Modified
        }
    } catch (e) {
        console.warn("Could not update .gitignore", e);
    }

    return false; // <--- Not Modified
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

// UPDATED: Added includeBinaries parameter (default false)
async function scanFiles(rootDir: string, currentDir: string, extensions: string[], ignores: string[], includeBinaries: boolean = false): Promise<string[]> {
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
            const ext = path.extname(entry.name).toLowerCase();

            // UPDATED: Only skip binaries if the flag is explicitly FALSE
            if (!includeBinaries && BINARY_EXTENSIONS.has(ext)) {
                continue;
            }

            // UPDATED: If extensions list is empty, accept all
            if (extensions.length === 0 || extensions.includes(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

/**
 * LINEAR MERGE (Next Fit)
 * Preserves file order from the source tree. Pushes multipart files to the end.
 */
async function mergeFiles(
    files: { relPath: string, content: string }[],
    outputDir: string,
    maxChars: number
): Promise<string[]> {

    const createdFiles: string[] = [];
    let fileIndex = 1;

    // 1. Separate Standard vs Multipart
    // We preserve the incoming order (Source Tree order) for standard files.
    const standardFiles: { relPath: string, fullText: string }[] = [];
    const multipartFiles: { relPath: string, content: string }[] = [];

    for (const file of files) {
        const header = `\n${'='.repeat(50)}\nFile: ${file.relPath}\n${'='.repeat(50)}\n\n`;
        const fullText = header + file.content + "\n\n";

        if (fullText.length > maxChars) {
            multipartFiles.push(file);
        } else {
            standardFiles.push({ relPath: file.relPath, fullText });
        }
    }

    // 2. Process Standard Files (Linear Fill)
    let currentBuffer = "";
    let currentBufferIndex: string[] = [];

    const flushBuffer = async () => {
        if (currentBuffer.length === 0) return;

        const filename = `Source-${fileIndex} (${currentBufferIndex.length} Files).txt`;
        const indexHeader = "--- INDEX ---\n" + currentBufferIndex.join('\n') + "\n" + "-".repeat(30) + "\n\n";

        await fs.writeFile(path.join(outputDir, filename), indexHeader + currentBuffer, 'utf-8');
        createdFiles.push(filename);

        fileIndex++;
        currentBuffer = "";
        currentBufferIndex = [];
    };

    for (const item of standardFiles) {
        // If adding this file exceeds limit, flush current buffer first
        if (currentBuffer.length + item.fullText.length > maxChars) {
            await flushBuffer();
        }

        currentBuffer += item.fullText;
        currentBufferIndex.push(item.relPath);
    }

    // Flush remaining standard files
    await flushBuffer();

    // 3. Process Multipart Files (At the end)
    for (const file of multipartFiles) {
        let remaining = file.content;
        let part = 1;
        const totalParts = Math.ceil(remaining.length / (maxChars - 500));

        while (remaining.length > 0) {
            const header = `\n${'='.repeat(50)}\nFile: ${file.relPath} (Part ${part}/${totalParts})\n${'='.repeat(50)}\n\n`;
            const availableSpace = maxChars - header.length;

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

    return createdFiles;
}
