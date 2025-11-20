<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { templates } from '$lib/templates';
    import FileTreeNode from '$lib/components/FileTreeNode.svelte';
    import { fade, slide } from 'svelte/transition';

    // --- STATE ---

    let isDetecting = $state(true);
    let isProcessing = $state(false);
    let isAppLoading = $state(true);
    let settingsOpen = $state(false);
    let templatesExpanded = $state(false);

    // Data
    let detectedIds: string[] = $state([]);
    let detectionReasons: Record<string, string[]> = $state({});
    let gitStatus: 'none' | 'clean' | 'ignored' = $state('none');
    let selectedIds: string[] = $state([]);
    let maxChars = $state(75000);
    let customPath = $state('');
    let cwd = $state('');
    let sessionId = $state('');
    let savedCustomPath = $state('');
    let globalVaultPath = $state('');

    // TREE STATE
    let treeNodes: any[] = $state([]);
    let treeLoading = $state(false);
    let treeExpanded = $state(false);
    let selectedFilePaths: Set<string> = $state(new Set());

    let fileTypeMap = new Map<string, 'file' | 'folder'>();

    let useTreeMode = $derived(treeExpanded);



    // Dialog State
    let showSuccessDialog = $state(false);
    let showErrorDialog = $state(false);
    let dialogTitle = $state('');
    let dialogMessage = $state('');
    let successOutputPath = $state('');

    // --- COMPUTED ---

    let selectedTemplateObjects = $derived(templates.filter(t => selectedIds.includes(t.id)));
    let unselectedTemplateObjects = $derived(templates.filter(t => !selectedIds.includes(t.id)));



    let selectedFileCount = $derived.by(() => {
        let count = 0;
        for (const path of selectedFilePaths) {
            if (fileTypeMap.get(path) === 'file') {
                count++;
            }
        }
        return count;
    });

    // --- LOGIC ---

    onMount(async () => {
        await detect();
        await loadFileTree();
        setTimeout(() => {
            isAppLoading = false;
        }, 100);
        window.addEventListener('beforeunload', handleUnload);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handleUnload);
    });

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
            gitStatus = data.gitStatus;
            cwd = data.cwd;
            sessionId = data.sessionId;
            savedCustomPath = data.savedCustomPath;
            customPath = data.savedCustomPath;
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

    async function handleCustomClick(e: MouseEvent) {
        if (e.shiftKey && savedCustomPath) {
            customPath = savedCustomPath;
            runForge('custom');
            return;
        }
        isProcessing = true;
        try {
            const res = await fetch('/api/select-folder', { method: 'POST' });
            const data = await res.json();
            if (data.success && data.path) {
                customPath = data.path;
                savedCustomPath = data.path;
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
        loadFileTree();
    }

    function toggleTemplatesSection() {
        templatesExpanded = !templatesExpanded;
        if (!templatesExpanded) {
            selectedIds = [...detectedIds];
            loadFileTree();
        }
    }

    async function exitApp() {
        if (sessionId) {
            await fetch('/api/shutdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
                keepalive: true
            });
        }
        window.close();
        // Fallback UI if window doesn't close
        document.body.innerHTML = `
        <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#94a3b8;font-family:sans-serif;flex-direction:column;gap:1rem;background-image:radial-gradient(circle at 50% 50%, #f9731622 0%, #0000 70%);">
            <h1 style="font-size:2rem;color:#fb923c;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Session Concluded</h1>
            <p>You may close this tab.</p>
        </div>`;
    }

    async function loadFileTree() {
        treeLoading = true;
        try {
            const params = new URLSearchParams();
            if (selectedIds.length > 0) params.append('templates', selectedIds.join(','));
            const res = await fetch(`/api/tree?${params.toString()}`);
            const data = await res.json();
            treeNodes = data.tree;

            fileTypeMap.clear();
            const initialSet = new Set<string>();
            const processNode = (nodes: any[]) => {
                for (const node of nodes) {
                    fileTypeMap.set(node.path, node.type);
                    if (!node.isIgnored) {
                        if (node.type === 'folder') {
                            initialSet.add(node.path);
                            if (node.children) processNode(node.children);
                        } else {
                            initialSet.add(node.path);
                        }
                    }
                }
            };
            processNode(treeNodes);
            selectedFilePaths = initialSet;
        } catch (e) {
            dialogTitle = 'Tree Scan Failed';
            dialogMessage = 'Could not load file structure.';
            showErrorDialog = true;
        } finally {
            treeLoading = false;
        }
    }

    function handleTreeToggle(path: string, isFolder: boolean, forcedState?: boolean) {
        const newSet = new Set(selectedFilePaths);
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
        const nextState = forcedState !== undefined ? forcedState : !newSet.has(path);
        applyState(targetNode, nextState);
        selectedFilePaths = newSet;
    }

    async function runForge(mode: 'root' | 'global' | 'custom') {
        isProcessing = true;
        let payloadFiles: string[] | undefined = undefined;
        if (treeExpanded) {
            payloadFiles = Array.from(selectedFilePaths).filter(p => true);
        }
        try {
            const res = await fetch('/api/forge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    saveMode: mode,
                    customPath,
                    templateIds: selectedIds,
                    maxChars,
                    selectedFiles: payloadFiles
                })
            });
            const result = await res.json();
            if (result.success) {
                await fetch('/api/open', {
                    method: 'POST',
                    body: JSON.stringify({ path: result.outputPath })
                });
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
        }
    }
</script>

<div class="min-h-screen flex flex-col items-center p-8 relative overflow-hidden font-sans">

    <!-- GLOBAL LOADING OVERLAY -->
    {#if isAppLoading || isDetecting}
        <div class="fixed inset-0 z-[200] bg-[#020617] flex flex-col items-center justify-center" transition:fade>
             <!-- REMOVED animate-blob here to stop the dizziness -->
             <div class="relative">
                <div class="w-32 h-32 bg-orange-500/10 rounded-full animate-ping absolute top-0 left-0"></div>
                <div class="w-32 h-32 bg-orange-600/20 rounded-full relative flex items-center justify-center border border-orange-500/30 shadow-[0_0_80px_rgba(249,115,22,0.4)]">
                    <!-- Spinner -->
                    <svg class="w-12 h-12 text-orange-500 animate-spin duration-[3s]" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
                        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
             </div>
             <h2 class="mt-10 text-xl font-black text-orange-500 tracking-[0.3em] uppercase animate-pulse-slow">Initializing Forge...</h2>
             <p class="text-slate-600 text-xs mt-2 tracking-widest uppercase">Scanning local environment</p>
        </div>
    {/if}

    <!-- AMBIENT BACKGROUND EFFECTS (Accretion Disk) -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <!-- Main Central Glow (Orange/Magma) -->
        <div class="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] animate-blob mix-blend-screen"></div>

        <!-- Secondary Gravity Wells -->
        <div class="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-rose-700/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen"></div>
        <div class="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-violet-900/20 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-screen"></div>
    </div>

    <!-- SUCCESS DIALOG -->
    {#if showSuccessDialog}
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md" transition:fade>
            <div class="bg-[#0a0a0a] border border-emerald-500/30 rounded-3xl p-10 w-full max-w-lg shadow-[0_0_50px_rgba(16,185,129,0.15)] relative flex flex-col items-center text-center animate-fade-in-up">

                <!-- Success Icon -->
                <div class="w-24 h-24 bg-emerald-900/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.1)] border border-emerald-500/20">
                    <svg class="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                </div>

                <h3 class="text-3xl font-black text-white mb-3 tracking-tight">Forge Complete</h3>

                <p class="text-slate-400 mb-8 leading-relaxed">
                    Your files have been successfully merged and saved to:<br>
                    <span class="text-emerald-400/90 font-mono text-xs bg-emerald-950/30 px-3 py-1.5 rounded mt-3 inline-block border border-emerald-500/20 tracking-wide">{successOutputPath}</span>
                </p>

                <div class="flex flex-col gap-4 w-full">
                    <!--
                        FRIENDLY EXIT BUTTON
                        "Conclude Session" - Professional and non-destructive.
                    -->
                    <button
                        on:click={exitApp}
                        class="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-orange-500/50 text-orange-100 hover:text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 group"
                    >
                        <span class="text-orange-500 group-hover:scale-125 transition-transform duration-300">⦿</span>
                        <span>Conclude Session</span>
                    </button>

                    <!-- CONTINUE BUTTON -->
                    <button
                        on:click={() => showSuccessDialog = false}
                        class="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
                    >
                        Continue Forging
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ERROR DIALOG -->
    {#if showErrorDialog}
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" transition:fade>
            <div class="bg-slate-950 border border-red-900/50 rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-red-900/20 relative flex flex-col items-center text-center">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 border border-red-500/20">
                    <span class="text-3xl text-red-500">⚠</span>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">{dialogTitle}</h3>
                <p class="text-slate-400 mb-8 text-sm">{dialogMessage}</p>
                <button on:click={() => showErrorDialog = false} class="w-full py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 font-bold rounded-xl transition-colors">
                    Close
                </button>
            </div>
        </div>
    {/if}

    <!-- Header -->
    <div class="text-center mb-12 mt-8 animate-fade-in-up relative z-10">
        <h1 class="text-8xl font-black tracking-tighter mb-6 drop-shadow-[0_0_40px_rgba(249,115,22,0.3)]">
            <!-- MAGMA GRADIENT TEXT -->
            <span class="bg-gradient-to-r from-orange-400 via-rose-500 to-violet-500 bg-clip-text text-transparent animate-text-gradient bg-[length:200%_auto]">
                TXT-FORGE
            </span>
        </h1>

        <!-- Glass Pill Badge -->
        <div class="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/5 shadow-lg">
            <span class="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em]">Target:</span>
            <span class="text-orange-300 font-mono text-xs truncate max-w-[300px] drop-shadow-md" title={cwd}>
                {cwd || 'Scanning...'}
            </span>
        </div>
    </div>

    <div class="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">

        <!-- LEFT COLUMN: Configuration -->
        <div class="lg:col-span-2 flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.1s;">

            <!-- 1. TEMPLATES CARD (Glass Void) -->
            <div class="bg-[#050505]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <!-- subtle top highlight -->
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"></div>

                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-3">
                        <h2 class="text-xs font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                            {#if isDetecting}
                                <span class="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span> Detecting...
                            {:else if templatesExpanded}
                                <span class="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_#f59e0b]"></span>
                                Manual Selection
                            {:else}
                                <span class="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></span>
                                Auto-Detected Stack
                            {/if}
                        </h2>
                    </div>
                    <button on:click={toggleTemplatesSection} class="text-[10px] uppercase font-bold tracking-wider text-orange-400/80 hover:text-orange-300 transition-all hover:drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">
                        {templatesExpanded ? 'Reset to Auto' : 'Edit Templates'}
                    </button>
                </div>

                <!-- Selected/Detected View -->
                {#if selectedIds.length > 0}
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {#each selectedTemplateObjects as tmpl}
                            <div class="group relative">
                                <button
                                    on:click={() => toggleTemplate(tmpl.id)}
                                    class="w-full relative flex items-center gap-4 bg-white/5 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 text-slate-200 px-5 py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] hover:-translate-y-0.5"
                                >
                                    <img src={tmpl.iconUrl} alt={tmpl.name} class="w-6 h-6 brightness-0 invert opacity-60 group-hover:opacity-100 transition-all" />
                                    <span class="font-bold text-sm tracking-wide group-hover:text-orange-100">{tmpl.name}</span>
                                    <!-- Active Dot -->
                                    <span class="absolute top-3 right-3 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]"></span>
                                </button>

                                <!-- Tooltip -->
                                {#if detectionReasons[tmpl.id] && detectionReasons[tmpl.id].length > 0}
                                    <div class="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 z-20 pointer-events-none">
                                        <div class="bg-black border border-orange-500/20 rounded-lg p-2 text-[10px] text-slate-300 shadow-xl backdrop-blur-md">
                                            <div class="font-bold text-orange-400 mb-1 border-b border-orange-500/10 pb-1">Detected via:</div>
                                            <ul class="list-disc pl-3 space-y-0.5 text-slate-400">
                                                {#each detectionReasons[tmpl.id] as reason}
                                                    <li>{reason}</li>
                                                {/each}
                                            </ul>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                     <div class="text-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-2xl mb-6 bg-slate-950/30">
                        <div class="text-3xl mb-2 opacity-50">🔍</div>
                        <p class="text-xs uppercase tracking-widest">No templates detected.</p>
                        <button on:click={toggleTemplatesSection} class="text-orange-400 text-xs mt-3 hover:text-orange-300 font-bold">Select manually</button>
                     </div>
                {/if}

                <!-- Expander -->
                {#if templatesExpanded}
                    <div transition:slide class="border-t border-white/5 pt-6 mt-2">
                        <h3 class="text-[10px] uppercase font-bold text-slate-500 mb-4 px-1 tracking-widest">Add More Templates</h3>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {#each unselectedTemplateObjects as tmpl}
                                <button
                                    on:click={() => toggleTemplate(tmpl.id)}
                                    class="flex items-center gap-3 px-3 py-3 rounded-lg text-xs text-left transition-all bg-slate-900/40 text-slate-400 border border-transparent hover:bg-slate-800 hover:text-orange-200 hover:border-orange-500/20 group"
                                >
                                    <img src={tmpl.iconUrl} alt="" class="w-4 h-4 opacity-30 group-hover:opacity-100 brightness-0 invert transition-all" />
                                    {tmpl.name}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- 2. FILE TREE CARD -->
            <div class="bg-[#050505]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col gap-4 animate-fade-in-up relative overflow-hidden z-10" style="animation-delay: 0.15s;">
                <div class="flex justify-between items-center relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                            🌳
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-slate-200 uppercase tracking-[0.2em]">Source Tree</h2>
                            <div class="text-[10px] text-slate-500 font-mono">
                                {treeExpanded ? `${selectedFileCount} files selected` : 'Standard Filter Mode'}
                            </div>
                        </div>
                    </div>

                    <button
                        on:click={() => treeExpanded = !treeExpanded}
                        class="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border duration-300
                        {treeExpanded
                            ? 'bg-orange-900/20 text-orange-200 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800 hover:text-white'}"
                    >
                        {treeExpanded ? 'Close Tree' : 'Open Tree Browser'}
                    </button>
                </div>

                {#if treeNodes.length > 0 || treeLoading}
                    <div class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] {treeExpanded ? 'grid-rows-[1fr] border-t border-white/5 mt-2 pt-2' : 'grid-rows-[0fr] mt-0 pt-0'}">
                        <div class="overflow-hidden">
                            {#if treeLoading}
                                <div class="py-8 text-center text-slate-500 flex flex-col items-center gap-3">
                                    <div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span class="text-xs tracking-widest uppercase">Scanning entire codebase...</span>
                                </div>
                            {:else}
                                <div class="bg-black/40 rounded-xl border border-white/5 p-4 max-h-[500px] overflow-y-auto custom-scrollbar font-mono text-sm relative z-10 mt-2">
                                    {#each treeNodes as node (node.path)}
                                        <FileTreeNode
                                            {node}
                                            selectedPaths={selectedFilePaths}
                                            onToggle={handleTreeToggle}
                                        />
                                    {/each}
                                </div>
                                <div class="mt-3 flex items-center gap-2 text-[10px] text-orange-200/60 bg-orange-900/10 p-3 rounded-lg border border-orange-500/10 relative z-10">
                                    <span class="text-orange-400 text-lg">ℹ</span>
                                    <p>
                                        Items checked here will be <strong>merged exactly</strong> as seen.
                                        Generates <code class="bg-black/50 px-1 rounded text-orange-300">Source-Tree.txt</code>.
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
            <div class="bg-[#050505]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div class="flex justify-between items-center z-20 relative">
                    <div class="flex items-center gap-2 text-slate-300 text-xs font-bold tracking-[0.2em] uppercase">
                        <span>Split Strategy</span>
                    </div>
                    <button on:click={() => settingsOpen = !settingsOpen} class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-orange-500 text-slate-400 hover:text-white transition-all">
                        ⚙
                    </button>
                </div>

                <div class="grid grid-cols-1 grid-rows-1 mt-4 min-h-[40px]">
                    {#if settingsOpen}
                        <div class="col-start-1 row-start-1 pt-1" transition:fade={{ duration: 200 }}>
                            <label class="text-[10px] text-orange-400 uppercase font-bold mb-2 block">Max Characters per File</label>
                            <div class="flex gap-4 items-center">
                                <input
                                    type="range" min="10000" max="200000" step="5000"
                                    bind:value={maxChars}
                                    class="flex-1 accent-orange-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <span class="font-mono text-white text-xs bg-orange-600 px-2 py-1 rounded shadow-lg">
                                    {(maxChars / 1000).toFixed(0)}k
                                </span>
                            </div>
                        </div>
                    {:else}
                         <div class="col-start-1 row-start-1" transition:fade={{ duration: 200 }}>
                            <div class="text-[11px] text-slate-500 font-medium leading-relaxed">
                                Files larger than <span class="text-orange-400">{(maxChars/1000).toFixed(0)}k</span> chars will be smartly split at function boundaries.
                             </div>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- ACTIONS -->
            <div class="grid gap-4">

                <!-- 1. SAVE TO PROJECT (MAGMA THEME) -->
                <button on:click={() => runForge('root')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-black/50 border border-white/5 hover:border-orange-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] hover:-translate-y-1 flex flex-col justify-center px-8 py-6">

                    <!-- Magma Gradient Background (Hidden usually, revealed on hover opacity) -->
                    <div class="absolute inset-0 bg-gradient-to-br from-orange-900/20 to-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <!-- Icon -->
                    <svg class="absolute -right-5 -bottom-5 w-40 h-40 text-orange-500/5 group-hover:text-orange-500/20 transition-colors -rotate-12 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform shrink-0 border border-orange-500/20">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
                                </div>
                                {#if gitStatus !== 'none'}
                                    <span class="text-[9px] font-bold uppercase bg-orange-950 border border-orange-900 text-orange-300 px-2 py-0.5 rounded">Git Detected</span>
                                {/if}
                            </div>
                        </div>

                        <div class="font-black text-lg text-white group-hover:text-orange-100 transition-colors tracking-tight">
                            Save to Project
                        </div>

                        <div class="text-[10px] text-slate-500 font-mono mt-1 break-all pr-8 uppercase tracking-wider">
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

                <!-- 2. SAVE TO GLOBAL VAULT (VIOLET/VOID THEME) -->
                <button on:click={() => runForge('global')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-black/50 border border-white/5 hover:border-violet-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] hover:-translate-y-1 flex flex-col justify-center px-8 py-6">

                    <div class="absolute inset-0 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <svg class="absolute -right-8 -bottom-8 w-48 h-48 text-violet-500/5 group-hover:text-violet-500/15 transition-colors rotate-6 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="mb-2">
                            <div class="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform shrink-0 border border-violet-500/20">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </div>
                        </div>
                        <div class="font-black text-lg text-white group-hover:text-violet-100 transition-colors tracking-tight">Save to Global Vault</div>
                        <div class="text-[10px] text-slate-500 font-mono mt-1 break-all pr-10 relative uppercase tracking-wider" title={globalVaultPath}>
                            ~/.txt-forge-vault
                        </div>
                    </div>
                </button>

                <!-- 3. SAVE TO CUSTOM (AMBER/GOLD THEME) -->
                <button
                    on:click={handleCustomClick}
                    disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden min-h-[8rem] rounded-3xl bg-black/50 border border-white/5 hover:border-amber-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:-translate-y-1 flex flex-col justify-center px-8 py-6"
                >
                    <div class="absolute inset-0 bg-gradient-to-br from-amber-900/20 to-yellow-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <svg class="absolute -right-8 -bottom-8 w-44 h-44 text-amber-500/5 group-hover:text-amber-500/15 transition-colors rotate-6 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 6h2v8h-2v-8zm1 12.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                    </svg>

                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-2">
                            <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform shrink-0 border border-amber-500/20">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </div>
                            {#if savedCustomPath}
                                <span class="hidden group-hover:inline-block text-[9px] font-bold uppercase bg-amber-950 border border-amber-500/30 text-amber-300 px-2 py-1 rounded animate-fade-in-up">
                                    Shift+Click
                                </span>
                            {/if}
                        </div>

                        <div class="font-black text-lg text-white group-hover:text-amber-100 transition-colors tracking-tight">Save to Custom Location</div>

                        <div class="text-[10px] text-slate-500 font-mono mt-1 break-all pr-6 relative uppercase tracking-wider" title={savedCustomPath}>
                            {savedCustomPath ? savedCustomPath : 'Click to browse folders...'}
                        </div>
                    </div>
                </button>
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="mt-auto pt-16 pb-8 text-center">
        <p class="text-[9px] text-slate-700 font-bold tracking-[0.3em] uppercase hover:text-orange-900 transition-colors cursor-default">TXT-FORGE v2.0 • Local Environment</p>
    </div>
</div>

<style>
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(249, 115, 22, 0.2) rgba(255,255,255,0.02);
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(249, 115, 22, 0.15);
        border-radius: 4px;
        border: 1px solid rgba(249, 115, 22, 0.05);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(249, 115, 22, 0.3);
    }
</style>