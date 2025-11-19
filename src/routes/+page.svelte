<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { templates } from '$lib/templates';
    import { fade, slide } from 'svelte/transition';

    // --- STATE ---
    let isDetecting = $state(true);
    let isProcessing = $state(false);
    let settingsOpen = $state(false);
    let templatesExpanded = $state(false);
    let customPathOpen = $state(false);

    // Data
    let detectedIds: string[] = $state([]);
    let selectedIds: string[] = $state([]);
    let maxChars = $state(75000);
    let customPath = $state('');
    let cwd = $state('');

    // Results
    let result: { success: boolean; outputPath: string; files: string[] } | null = $state(null);

    // --- COMPUTED ---
    let selectedTemplateObjects = $derived(templates.filter(t => selectedIds.includes(t.id)));
    let unselectedTemplateObjects = $derived(templates.filter(t => !selectedIds.includes(t.id)));

    // --- LOGIC ---

    onMount(async () => {
        await detect();
        window.addEventListener('beforeunload', handleUnload);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handleUnload);
    });

    // Send kill signal to server
    function handleUnload() {
        navigator.sendBeacon('/api/shutdown');
    }

    async function detect() {
        try {
            const res = await fetch('/api/detect');
            const data = await res.json();
            detectedIds = data.detected;
            cwd = data.cwd;
            // Default logic: Only select detected
            selectedIds = [...detectedIds];
        } catch (e) {
            console.error(e);
        } finally {
            isDetecting = false;
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

        // Logic: If user closes the manual selection, revert to auto-detected
        if (!templatesExpanded) {
            selectedIds = [...detectedIds];
        }
    }

    async function runForge(mode: 'root' | 'global' | 'custom') {
        if (mode === 'custom' && !customPath) {
            customPathOpen = true;
            return;
        }

        isProcessing = true;
        result = null;

        try {
            const res = await fetch('/api/forge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    saveMode: mode,
                    customPath,
                    templateIds: selectedIds,
                    maxChars
                })
            });
            result = await res.json();

            // Auto-open folder on success
            if (result && result.success) {
                await fetch('/api/open', {
                    method: 'POST',
                    body: JSON.stringify({ path: result.outputPath })
                });
            }

        } catch (e) {
            alert("Connection error");
        } finally {
            isProcessing = false;
            customPathOpen = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col items-center p-8 relative">

    <!-- Header -->
    <div class="text-center mb-10 mt-8 animate-fade-in-up">
        <h1 class="text-7xl font-black tracking-tighter bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent mb-4 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">
            TXT-FORGE
        </h1>
        <div class="inline-flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-full border border-white/10">
            <span class="text-slate-500 text-xs uppercase font-bold tracking-widest">Target:</span>
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
                            <button
                                on:click={() => toggleTemplate(tmpl.id)}
                                class="group relative flex items-center gap-4 bg-indigo-900/20 hover:bg-indigo-500/20 border border-indigo-500/40 hover:border-indigo-400 text-white px-5 py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:-translate-y-0.5"
                            >
                                <!-- Added brightness-0 invert to make icons white -->
                                <img src={tmpl.iconUrl} alt={tmpl.name} class="w-8 h-8 brightness-0 invert opacity-90 group-hover:opacity-100 transition-all group-hover:scale-110" />
                                <span class="font-bold text-base tracking-wide">{tmpl.name}</span>
                                <span class="absolute top-2 right-2 w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]"></span>
                            </button>
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

        </div>

        <!-- RIGHT COLUMN: Actions -->
        <div class="flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.2s;">

            <!-- SETTINGS CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 text-slate-300 text-sm font-bold tracking-wide">
                        <span>📐 SPLIT STRATEGY</span>
                    </div>
                    <button on:click={() => settingsOpen = !settingsOpen} class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-indigo-500 text-slate-400 hover:text-white transition-all">
                        ⚙
                    </button>
                </div>

                {#if settingsOpen}
                    <div transition:fade class="mt-5 pt-5 border-t border-white/5">
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
                     <div class="mt-3 text-xs text-slate-500 font-medium leading-relaxed">
                        Files larger than <span class="text-indigo-400">{(maxChars/1000).toFixed(0)}k</span> chars will be smartly split at function boundaries.
                     </div>
                {/if}
            </div>

            <!-- ACTIONS -->
            <div class="grid gap-4">
                <button on:click={() => runForge('root')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-indigo-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-2">📁</div>
                        <div class="font-bold text-lg text-white">Project Root</div>
                        <div class="text-xs text-slate-500 font-mono mt-1">./TXT-Forge</div>
                    </div>
                </button>

                <button on:click={() => runForge('global')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-cyan-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-cyan-500/20 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-2">🏦</div>
                        <div class="font-bold text-lg text-white">Global Vault</div>
                        <div class="text-xs text-slate-500 font-mono mt-1">~/.txt-forge-vault</div>
                    </div>
                </button>

                <button on:click={() => customPathOpen = true} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-emerald-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-2">📍</div>
                        <div class="font-bold text-lg text-white">Custom Path</div>
                        <div class="text-xs text-slate-500 font-mono mt-1">{customPath ? customPath : 'Select destination...'}</div>
                    </div>
                </button>
            </div>
        </div>
    </div>

    <!-- SUCCESS OVERLAY / RESULT -->
    {#if result}
        <div transition:fade class="mt-8 w-full max-w-4xl bg-emerald-900/20 border border-emerald-500/30 rounded-3xl p-6 flex items-start gap-5 backdrop-blur-md shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <div class="bg-emerald-500 rounded-full p-3 text-slate-900 shadow-lg shadow-emerald-500/50">✓</div>
            <div class="flex-1">
                <h3 class="text-lg font-bold text-emerald-400 mb-1">Forging Complete!</h3>
                <p class="text-sm text-emerald-200/70 mb-4 font-mono">{result.outputPath}</p>
                <div class="bg-slate-950/80 rounded-xl p-4 max-h-40 overflow-y-auto font-mono text-[11px] text-emerald-400/80 custom-scrollbar border border-white/5">
                    {#each result.files as f}
                        <div class="py-0.5 border-b border-white/5 last:border-0">📄 {f}</div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    <!-- CUSTOM PATH MODAL -->
    {#if customPathOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" transition:fade>
            <div class="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
                <button on:click={() => customPathOpen = false} class="absolute top-4 right-4 text-slate-500 hover:text-white p-2">✕</button>
                <h3 class="text-xl font-bold text-white mb-4">Custom Destination</h3>
                <p class="text-sm text-slate-400 mb-6">Paste the absolute path where you want the forged files to be created.</p>
                <input
                    type="text"
                    bind:value={customPath}
                    placeholder="e.g. /Users/Dev/Project/Output"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-sm text-white focus:border-indigo-500 outline-none mb-6 font-mono placeholder:text-slate-700"
                    autofocus
                />
                <button
                    on:click={() => runForge('custom')}
                    disabled={!customPath}
                    class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Forge Files Here
                </button>
            </div>
        </div>
    {/if}

    <!-- FOOTER -->
    <div class="mt-auto pt-16 pb-8 text-center">
        <p class="text-[10px] text-slate-600 font-medium tracking-widest uppercase">TXT-FORGE v2.0 • Local Environment</p>
    </div>
</div>

<style>
    /* Custom Scrollbar for inner containers */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.02);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.2);
    }
</style>