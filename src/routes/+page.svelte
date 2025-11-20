<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { templates } from '$lib/templates';
    import FileTreeNode from '$lib/components/FileTreeNode.svelte';
    import { fade, slide, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing'; // Import smoothing easing
    import { flip } from 'svelte/animate';

    // --- STATE ---
    let isDetecting = $state(true);
    let isProcessing = $state(false);
    // NEW: Explicit loading state for initial load
    let isAppLoading = $state(true);
    let settingsOpen = $state(false);
    let templatesExpanded = $state(false);

    // Data
    let detectedIds: string[] = $state([]);
    let detectionReasons: Record<string, string[]> = $state({});

    // NEW: Granular Git Status
    let gitStatus: 'none' | 'clean' | 'ignored' = $state('none');

    let selectedIds: string[] = $state([]);
    let maxChars = $state(75000);
    let customPath = $state('');
    let cwd = $state('');

    // NEW: Session ID for safe shutdown
    let sessionId = $state('');

    // UPDATE: Add these new state variables
    let savedCustomPath = $state('');
    let globalVaultPath = $state('');

    // TREE STATE
    let treeNodes: any[] = $state([]);
    let treeLoading = $state(false);
    let treeExpanded = $state(false);
    let selectedFilePaths: Set<string> = $state(new Set()); // Stores RELATIVE paths of checked items

    // Determines if we are using "Manual Tree" mode or "Stack Detection" mode
    // Logic: If the user touches the tree, we assume they want specific files.
    // But for simplicity, let's make the Tree Panel *always* the source of truth if expanded,
    // or we sync them.
    // BETTER LOGIC: The tree starts with "Detected" files checked (if possible), but since we scan everything,
    // let's keep it simple:
    // 1. Detection finds templates.
    // 2. User opens Tree.
    // 3. Tree loads. Initially, we default to "Everything NOT ignored".
    // 4. If Tree is visible, we send selectedFilePaths. If Tree is closed, we send selectedIds (templates).
    let useTreeMode = $derived(treeExpanded); 

    // Helper to recursively get all file paths from a node
    function getAllFilePaths(node: any): string[] {
        let paths: string[] = [];
        if (node.type === 'file') paths.push(node.path);
        if (node.children) {
            node.children.forEach((child: any) => {
                paths = paths.concat(getAllFilePaths(child));
            });
        }
        return paths;
    }

    // Dialog State
    let showSuccessDialog = $state(false);
    let showErrorDialog = $state(false);
    let dialogTitle = $state('');
    let dialogMessage = $state('');
    let successOutputPath = $state('');

    // --- COMPUTED ---
    let selectedTemplateObjects = $derived(templates.filter(t => selectedIds.includes(t.id)));
    let unselectedTemplateObjects = $derived(templates.filter(t => !selectedIds.includes(t.id)));

    // Count only selected files (not folders) for UI display
    // CHANGE: Used $derived.by to execute the function immediately and get the return value
    let selectedFileCount = $derived.by(() => {
        return Array.from(selectedFilePaths).filter(path => {
            // Find the node in treeNodes and check if it's a file
            const findNode = (nodes: any[]): any => {
                for (const node of nodes) {
                    if (node.path === path) return node;
                    if (node.children) {
                        const found = findNode(node.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            const node = findNode(treeNodes);
            return node && node.type === 'file';
        }).length;
    });

    // --- LOGIC ---
    onMount(async () => {
        // Only detect on mount. Tree load is now reactive.
        await detect();
        // REMOVED: isAppLoading = false; (We wait for the tree now)
        window.addEventListener('beforeunload', handleUnload);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handleUnload);
    });

    // NEW: Reactive Tree Loader
    // Whenever selectedIds changes (or detection finishes), reload the tree
    $effect(() => {
        // FIX: Removed "!isAppLoading" from the check to prevent deadlock.
        // We want the tree to load immediately after detection finishes.
        if (!isDetecting) {
             loadFileTree();
        }
    });

    // FIX: Use fetch with keepalive instead of sendBeacon to fix JSON errors
    function handleUnload() {
        if (!sessionId) return;

        fetch('/api/shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
            keepalive: true
        });
    }

    async function detect() {
        try {
            const res = await fetch('/api/detect');
            const data = await res.json();
            detectedIds = data.ids;
            detectionReasons = data.reasons || {};

            // Store the new Git Status
            gitStatus = data.gitStatus;

            cwd = data.cwd;

            // Capture the session ID passed from the server (We need to update detect endpoint to return this)
            // See Step 4.1 below
            sessionId = data.sessionId;

            // NEW: Load paths from backend
            savedCustomPath = data.savedCustomPath;
            customPath = data.savedCustomPath; // Pre-fill current logic
            globalVaultPath = data.globalVaultPath;

            selectedIds = [...detectedIds];
        } catch (e) {
            console.error(e);
            dialogTitle = 'Detection Failed';
            dialogMessage = 'Could not scan directory. Please ensure the server is running correctly.';
            showErrorDialog = true;
        } finally {
            isDetecting = false;
        }
    }

    // NEW: Handler for Custom Path Button
    async function handleCustomClick(e: MouseEvent) {
        // 1. Check for Shift + Click shortcut
        if (e.shiftKey && savedCustomPath) {
            customPath = savedCustomPath;
            runForge('custom');
            return;
        }

        // 2. Normal Click: Open Native OS Dialog via API
        isProcessing = true;
        try {
            const res = await fetch('/api/select-folder', { method: 'POST' });
            const data = await res.json();

            if (data.success && data.path) {
                customPath = data.path;
                savedCustomPath = data.path; // Update local state immediately

                // Auto-run forge after selection?
                // Let's just select the path, then user clicks again or we run it.
                // Requirement implies selecting folder then running.
                // Let's run immediately to be smooth:
                await runForge('custom');
            }
        } catch (err) {
            console.error(err);
        } finally {
            isProcessing = false;
        }
    }

    function toggleTemplate(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(i => i !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    function toggleTemplatesSection() {
        templatesExpanded = !templatesExpanded;
        if (!templatesExpanded) {
            selectedIds = [...detectedIds];
        }
    }

    async function exitApp() {
        if (sessionId) {
            // Send shutdown signal
            await fetch('/api/shutdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
                keepalive: true
            });
        }
        // Close tab or show shutdown message
        window.close();
        document.body.innerHTML = `<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#94a3b8;font-family:sans-serif;flex-direction:column;gap:1rem;">
            <h1 style="font-size:2rem;color:#e2e8f0;">TXT-FORGE Terminated</h1>
            <p>You can now close this tab.</p>
        </div>`;
    }

    async function loadFileTree() {
        // Guard: If we are already loading, don't stack requests
        // (Optional but good practice)
        if (treeLoading && !isAppLoading) return;

        treeLoading = true;

        try {
            // Pass active templates to backend
            const params = new URLSearchParams();
            if (selectedIds.length > 0) {
                params.append('templates', selectedIds.join(','));
            }
            const res = await fetch(`/api/tree?${params.toString()}`);
            const data = await res.json();
            treeNodes = data.tree;

            // Initialize Selection: Select everything that is NOT ignored
            const initialSet = new Set<string>();

            const traverseAndSelect = (nodes: any[]) => {
                for (const node of nodes) {
                    if (!node.isIgnored) {
                        // If folder, we effectively select it by selecting its files
                        if (node.type === 'folder') {
                            initialSet.add(node.path);
                            if (node.children) traverseAndSelect(node.children);
                        } else {
                            initialSet.add(node.path);
                        }
                    }
                }
            };

            traverseAndSelect(treeNodes);
            selectedFilePaths = initialSet;

        } catch (e) {
            dialogTitle = 'Tree Scan Failed';
            dialogMessage = 'Could not load file structure.';
            showErrorDialog = true;
        } finally {
            treeLoading = false;
            // NEW: Only hide the loading screen after the tree has attempted to load
            if (isAppLoading) {
                // Small delay to ensure transition is smooth
                setTimeout(() => {
                    isAppLoading = false;
                }, 500);
            }
        }
    }

    // Handle toggling a node
    function handleTreeToggle(path: string, isFolder: boolean, forcedState?: boolean) {
        const newSet = new Set(selectedFilePaths);

        // Helper to find node data
        const findNode = (nodes: any[]): any => {
            for (const node of nodes) {
                if (node.path === path) return node;
                if (node.children) {
                    const found = findNode(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const targetNode = findNode(treeNodes);
        if (!targetNode) return;
        const applyState = (node: any, state: boolean) => {
            if (state) newSet.add(node.path);
            else newSet.delete(node.path);

            if (node.children) {
                node.children.forEach((child: any) => applyState(child, state));
            }
        };
        // If forcedState is provided, use it. Otherwise toggle.
        const nextState = forcedState !== undefined ? forcedState : !newSet.has(path);
        applyState(targetNode, nextState);

        selectedFilePaths = newSet;
    }

    async function runForge(mode: 'root' | 'global' | 'custom') {
        // UPDATE: Remove the old modal check
        // if (mode === 'custom' && !customPath) { ... } -> REMOVED
        isProcessing = true;

        // PREPARE PAYLOAD
        // If tree is expanded, we send specific files.
        // Note: We only send FILE paths to backend, backend doesn't care about folder paths in the list
        let payloadFiles: string[] | undefined = undefined;

        if (treeExpanded) {
            payloadFiles = Array.from(selectedFilePaths).filter(p => {
                // Simple check: does it look like a file? (Logic handled better by verifying against tree data,
                // but passing all paths is fine, backend checks existence)
                return true;
            });
        }
        try {
            const res = await fetch('/api/forge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    saveMode: mode,
                    customPath,
                    templateIds: selectedIds, // Still send these for metadata if needed
                    maxChars,
                    selectedFiles: payloadFiles // <--- NEW
                })
            });
            // ... rest of existing logic ...
            const result = await res.json();
            if (result.success) {
                // Open folder immediately (optional, keep if desired)
                await fetch('/api/open', {
                    method: 'POST',
                    body: JSON.stringify({ path: result.outputPath })
                });

                // Show Success Dialog
                successOutputPath = result.outputPath;
                showSuccessDialog = true;
            } else {
                dialogTitle = 'Forging Failed';
                dialogMessage = result.message;
                showErrorDialog = true;
            }
        } catch (e) {
            dialogTitle = 'Connection Error';
            dialogMessage = 'Failed to communicate with server.';
            showErrorDialog = true;
        } finally {
            isProcessing = false;
            customPathOpen = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col items-center p-8 relative overflow-hidden">

    <!-- GLOBAL LOADING OVERLAY -->
    {#if isAppLoading || isDetecting}
        <div class="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center" transition:fade>
             <div class="relative">
                <div class="w-24 h-24 bg-indigo-500/20 rounded-full animate-ping absolute top-0 left-0"></div>
                <div class="w-24 h-24 bg-indigo-500/20 rounded-full animate-blob relative flex items-center justify-center border border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.5)]">
                    <svg class="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
             </div>
             <h2 class="mt-8 text-xl font-bold text-white tracking-widest uppercase animate-pulse">Initializing Forge...</h2>
             <p class="text-slate-500 text-sm mt-2">Scanning local environment</p>
        </div>
    {/if}

    <!-- AMBIENT BACKGROUND EFFECTS -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <!-- Top glow following the logo -->
        <div class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] animate-blob mix-blend-screen"></div>
        <!-- Secondary glow -->
        <div class="absolute top-[10%] left-[20%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[80px] animate-blob animation-delay-2000 mix-blend-screen"></div>
        <div class="absolute top-[10%] right-[20%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[80px] animate-blob animation-delay-4000 mix-blend-screen"></div>
    </div>

    <!-- SUCCESS DIALOG -->
    {#if showSuccessDialog}
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" transition:fade>

            <div class="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 w-full max-w-lg shadow-2xl shadow-emerald-900/20 relative flex flex-col items-center text-center animate-fade-in-up">

                <div class="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>

                <h3 class="text-3xl font-black text-white mb-2 tracking-tight">Forge Complete</h3>

                <p class="text-slate-400 mb-8 leading-relaxed">
                    Your files have been successfully merged and saved to:<br>
                    <span class="text-emerald-400 font-mono text-sm bg-emerald-950/50 px-2 py-1 rounded mt-2 inline-block border border-emerald-500/20">{successOutputPath}</span>
                </p>

                <div class="flex flex-col gap-3 w-full">
                    <!-- EXIT BUTTON (BIG) -->
                    <button
                        on:click={exitApp}
                        class="w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-red-500/25 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 text-lg"
                    >
                        <span>✕</span> Close App & Exit
                    </button>
                    <!-- CONTINUE BUTTON (REGULAR) -->
                    <button
                        on:click={() => showSuccessDialog = false}
                        class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors border border-white/5 hover:border-white/10"
                    >
                        Continue Forging
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ERROR DIALOG -->
    {#if showErrorDialog}
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" transition:fade>

            <div class="bg-slate-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-red-900/20 relative flex flex-col items-center text-center animate-fade-in-up">

                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5">
                    <span class="text-3xl">⚠️</span>
                </div>

                <h3 class="text-2xl font-bold text-white mb-2">{dialogTitle}</h3>

                <p class="text-slate-400 mb-8 text-sm">{dialogMessage}</p>

                <button
                    on:click={() => showErrorDialog = false}
                    class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    {/if}

    <!-- Header -->
    <div class="text-center mb-10 mt-8 animate-fade-in-up relative z-10">
        <h1 class="text-7xl font-black tracking-tighter mb-4 drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <span class="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-text-gradient bg-[length:200%_auto]">
                TXT-FORGE
            </span>
        </h1>

        <!-- Glass pill badge -->
        <div class="inline-flex items-center gap-2 bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <span class="text-slate-400 text-xs uppercase font-bold tracking-widest">Target:</span>
            <span class="text-indigo-300 font-mono text-xs truncate max-w-[300px]" title={cwd}>
                {cwd || 'Loading...'}
            </span>
        </div>
    </div>

    <div class="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">

        <!-- LEFT COLUMN: Configuration -->
        <div class="lg:col-span-2 flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.1s;">

            <!-- 1. TEMPLATES CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-3">
                        <h2 class="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            {#if isDetecting}
                                <span class="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></span> Detecting...
                            {:else if templatesExpanded}
                                <span class="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></span>
                                Manual Selection
                            {:else}
                                <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></span>
                                Auto-Detected Stack
                            {/if}
                        </h2>
                    </div>
                    {#if templatesExpanded}
                        <button on:click={toggleTemplatesSection} class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg transition-colors">
                            Reset to Auto
                        </button>
                    {:else}
                        <button on:click={toggleTemplatesSection} class="text-xs text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 hover:decoration-indigo-400 transition-all">
                            Edit Templates
                        </button>
                    {/if}
                </div>

                <!-- Selected/Detected View -->
                {#if selectedIds.length > 0}
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {#each selectedTemplateObjects as tmpl}
                            <div class="group relative">
                                <button
                                    on:click={() => toggleTemplate(tmpl.id)}
                                    class="w-full relative flex items-center gap-4 bg-indigo-900/20 hover:bg-indigo-500/20 border border-indigo-500/40 hover:border-indigo-400 text-white px-5 py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:-translate-y-0.5"
                                >
                                    <img src={tmpl.iconUrl} alt={tmpl.name} class="w-8 h-8 brightness-0 invert opacity-90 group-hover:opacity-100 transition-all group-hover:scale-110" />
                                    <span class="font-bold text-base tracking-wide">{tmpl.name}</span>
                                    <span class="absolute top-2 right-2 w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]"></span>
                                </button>

                                <!-- REASON TOOLTIP (New Feature) -->
                                {#if detectionReasons[tmpl.id] && detectionReasons[tmpl.id].length > 0}
                                    <div class="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 z-20 pointer-events-none">
                                        <div class="bg-black/90 border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 shadow-xl backdrop-blur-md">
                                            <div class="font-bold text-indigo-400 mb-1 border-b border-white/10 pb-1">Detected via:</div>
                                            <ul class="list-disc pl-3 space-y-0.5">
                                                {#each detectionReasons[tmpl.id] as reason}
                                                    <li>{reason}</li>
                                                {/each}
                                            </ul>
                                        </div>
                                        <!-- Arrow -->
                                        <div class="w-2 h-2 bg-black/90 border-r border-b border-white/10 absolute left-1/2 -translate-x-1/2 -bottom-1 rotate-45"></div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                     <div class="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl mb-6 bg-slate-950/30">
                        <div class="text-3xl mb-2">🔍</div>
                        <p>No templates detected.</p>
                        <button on:click={toggleTemplatesSection} class="text-indigo-400 text-sm mt-2 hover:underline">Select manually</button>
                     </div>
                {/if}

                <!-- Expander for All Templates -->
                {#if templatesExpanded}
                    <div transition:slide class="border-t border-white/5 pt-6 mt-2">
                        <h3 class="text-[11px] uppercase font-bold text-slate-500 mb-4 px-1">Add More Templates</h3>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {#each unselectedTemplateObjects as tmpl}
                                <button
                                    on:click={() => toggleTemplate(tmpl.id)}
                                    class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all bg-slate-950/40 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white hover:border-white/10 group"
                                >
                                    <img src={tmpl.iconUrl} alt="" class="w-5 h-5 opacity-40 group-hover:opacity-100 brightness-0 invert transition-all" />
                                    {tmpl.name}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- 2. FILE TREE CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-4 animate-fade-in-up relative overflow-hidden z-10" style="animation-delay: 0.15s;">
                <!-- Glass reflection effect -->
                <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                <div class="flex justify-between items-center relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            🌳
                        </div>
                        <div>
                            <h2 class="text-sm font-bold text-white uppercase tracking-widest">Source Tree</h2>
                            <div class="text-[10px] text-slate-500 font-mono">
                                {treeExpanded
                                    ? `${selectedFileCount} files selected`
                                    : 'Standard Filter Mode'}
                            </div>
                        </div>
                    </div>

                    <button
                        on:click={() => treeExpanded = !treeExpanded}
                        class="px-4 py-2 rounded-xl text-xs font-bold transition-all border duration-300
                        {treeExpanded
                            ? 'bg-blue-600/20 text-blue-200 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'}"
                    >
                        {treeExpanded ? 'Close Tree' : 'Open Tree Browser'}
                    </button>
                </div>

                <!-- PERFORMANCE FIX: CSS Grid Transition -->
                <!-- We render this block if nodes exist, but toggle grid-rows to animate height -->
                {#if treeNodes.length > 0 || treeLoading}
                    <div class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] {treeExpanded ? 'grid-rows-[1fr] border-t border-white/5 mt-2 pt-2' : 'grid-rows-[0fr] mt-0 pt-0'}">
                        <div class="overflow-hidden">
                            {#if treeLoading}
                                <div class="py-8 text-center text-slate-500 flex flex-col items-center gap-3">
                                    <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span class="text-xs">Scanning entire codebase...</span>
                                </div>
                            {:else}
                                <div class="bg-slate-950/50 rounded-xl border border-white/5 p-4 max-h-[500px] overflow-y-auto custom-scrollbar font-mono text-sm relative z-10 mt-2">
                                    {#each treeNodes as node (node.path)}
                                        <FileTreeNode
                                            {node}
                                            selectedPaths={selectedFilePaths}
                                            onToggle={handleTreeToggle}
                                        />
                                    {/each}
                                </div>

                                <div class="mt-3 flex items-center gap-2 text-[10px] text-slate-500 bg-blue-900/10 p-3 rounded-lg border border-blue-500/10 relative z-10">
                                    <span class="text-blue-400 text-lg">ℹ</span>
                                    <p>
                                        Items checked here will be <strong>merged exactly</strong> as seen.
                                        Standard template filters are ignored when using the tree.
                                        A <code class="bg-black/30 px-1 rounded text-blue-300">Source-Tree.txt</code> file will be generated.
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>

        </div>

        <!-- RIGHT COLUMN: Actions -->
        <div class="flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.2s;">

            <!-- SETTINGS CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div class="flex justify-between items-center z-20 relative">
                    <div class="flex items-center gap-2 text-slate-300 text-sm font-bold tracking-wide">
                        <span>📐 SPLIT STRATEGY</span>
                    </div>
                    <button on:click={() => settingsOpen = !settingsOpen} class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-indigo-500 text-slate-400 hover:text-white transition-all">
                        ⚙
                    </button>
                </div>

                <!-- ANIMATION FIX: Use a Grid Stack to overlap transitions smoothly -->
                <div class="grid grid-cols-1 grid-rows-1 mt-4">
                    {#if settingsOpen}
                        <div
                            class="col-start-1 row-start-1 pt-1"
                            transition:fade={{ duration: 200 }}
                        >
                            <label class="text-[10px] text-indigo-300 uppercase font-bold mb-3 block">Max Characters per File</label>
                            <div class="flex gap-4 items-center">
                                <input
                                    type="range" min="10000" max="200000" step="5000"
                                    bind:value={maxChars}
                                    class="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <span class="font-mono text-white text-sm bg-indigo-600 px-3 py-1 rounded-lg shadow-lg">
                                    {(maxChars / 1000).toFixed(0)}k
                                </span>
                            </div>
                        </div>
                    {:else}
                         <div
                            class="col-start-1 row-start-1"
                            transition:fade={{ duration: 200 }}
                        >
                            <div class="text-xs text-slate-500 font-medium leading-relaxed">
                                Files larger than <span class="text-indigo-400">{(maxChars/1000).toFixed(0)}k</span> chars will be smartly split at function boundaries.
                             </div>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- ACTIONS -->
            <div class="grid gap-4">

                <!-- 1. SAVE TO PROJECT BUTTON -->
                <button on:click={() => runForge('root')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-slate-900 border border-slate-700 hover:border-indigo-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1 flex flex-col justify-center px-8 py-6">

                    <!-- New Icon: Large Simple Download Arrow -->
                    <svg class="absolute -right-5 -bottom-5 w-40 h-40 text-indigo-500/5 group-hover:text-indigo-500/15 transition-colors -rotate-12 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
                                </div>
                                {#if gitStatus !== 'none'}
                                    <span class="text-[10px] font-bold uppercase bg-slate-800 border border-slate-600 text-indigo-300 px-2 py-0.5 rounded-full">Git Detected</span>
                                {/if}
                            </div>
                        </div>

                        <div class="font-bold text-lg text-white group-hover:text-indigo-200 transition-colors">
                            Save to Project
                        </div>

                        <div class="text-xs text-slate-500 font-mono mt-1 break-all pr-8">
                            {#if gitStatus === 'ignored'}
                                <span class="text-emerald-500/80">✓ .gitignore configured</span>
                            {:else if gitStatus === 'clean'}
                                <span class="text-amber-500/80">⚠ Will update .gitignore</span>
                            {:else}
                                ./TXT-Forge/
                            {/if}
                        </div>
                    </div>
                </button>

                <!-- 2. SAVE TO GLOBAL VAULT BUTTON -->
                <button on:click={() => runForge('global')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-slate-900 border border-slate-700 hover:border-cyan-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-cyan-500/20 hover:-translate-y-1 flex flex-col justify-center px-8 py-6">

                    <!-- Icon: Safe/Shield/Vault -->
                    <svg class="absolute -right-8 -bottom-8 w-48 h-48 text-cyan-500/5 group-hover:text-cyan-500/15 transition-colors rotate-6 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="mb-2">
                            <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </div>
                        </div>

                        <div class="font-bold text-lg text-white group-hover:text-cyan-200 transition-colors">Save to Global Vault</div>

                        <div class="text-xs text-slate-500 font-mono mt-1 break-all pr-10 relative" title={globalVaultPath}>
                            {globalVaultPath || '~/.txt-forge-vault'}
                        </div>
                    </div>
                </button>

                <!-- 3. SAVE TO CUSTOM LOCATION BUTTON -->
                <button
                    on:click={handleCustomClick}
                    disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-slate-900 border border-slate-700 hover:border-emerald-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1 flex flex-col justify-center px-8 py-6"
                >

                    <!-- Icon: Location/Target -->
                    <svg class="absolute -right-8 -bottom-8 w-44 h-44 text-emerald-500/5 group-hover:text-emerald-500/15 transition-colors rotate-6 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 6h2v8h-2v-8zm1 12.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-2">
                            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </div>

                            <!-- Shift Click Hint -->
                            {#if savedCustomPath}
                                <span class="hidden group-hover:inline-block text-[10px] font-bold uppercase bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded animate-fade-in-up">
                                    Shift+Click
                                </span>
                            {/if}
                        </div>

                        <div class="font-bold text-lg text-white group-hover:text-emerald-200 transition-colors">Save to Custom Location</div>

                        <div class="text-xs text-slate-500 font-mono mt-1 break-all pr-6 relative" title={savedCustomPath}>
                            {savedCustomPath ? savedCustomPath : 'Click to browse folders...'}
                        </div>
                    </div>
                </button>

            </div>

        </div>

    </div>


    <!-- FOOTER -->
    <div class="mt-auto pt-16 pb-8 text-center">
        <p class="text-[10px] text-slate-600 font-medium tracking-widest uppercase">TXT-FORGE v2.0 • Local Environment</p>
    </div>

</div>

<style>
    /* Custom Scrollbar for inner containers */
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) rgba(255,255,255,0.02);
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.02);
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.15);
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.02);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.25);
    }
    .custom-scrollbar::-webkit-scrollbar-corner {
        background: rgba(255,255,255,0.02);
    }
</style>