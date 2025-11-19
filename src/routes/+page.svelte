<script lang="ts">
    import { onMount } from 'svelte';
    import { templates } from '$lib/templates';
    import { fade } from 'svelte/transition';

    // --- STATE ---
    let isDetecting = $state(true);
    let isProcessing = $state(false);
    let settingsOpen = $state(false);
    let customPathOpen = $state(false);

    // Data
    let detectedIds: string[] = $state([]);
    let selectedIds: string[] = $state([]);
    let maxChars = $state(75000);
    let customPath = $state('');

    // Results
    let result: { success: boolean; outputPath: string; files: string[] } | null = $state(null);

    // --- COMPUTED ---
    let selectedTemplateObjects = $derived(templates.filter(t => selectedIds.includes(t.id)));
    let detectedTemplateObjects = $derived(templates.filter(t => detectedIds.includes(t.id)));

    // --- LOGIC ---

    onMount(async () => {
        await detect();
    });

    async function detect() {
        try {
            const res = await fetch('/api/detect');
            const data = await res.json();
            detectedIds = data.detected;
            // Default selection is what we detected, or everything if nothing detected?
            // Let's default to detected. If empty, user selects manually.
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
    <div class="text-center mb-12 mt-8 animate-fade-in-up">
        <h1 class="text-6xl font-black tracking-tighter bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent mb-4 drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            TXT-FORGE
        </h1>
        <p class="text-slate-400 font-light text-lg tracking-wide">Transforms codebases into AI-ready artifacts.</p>
    </div>

    <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">

        <!-- LEFT COLUMN: Configuration -->
        <div class="lg:col-span-2 flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.1s;">

            <!-- 1. TEMPLATES CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        {#if isDetecting}
                            <span class="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span> Detecting...
                        {:else}
                            <span class="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></span>
                            Detected Stack
                        {/if}
                    </h2>
                    <button on:click={() => selectedIds = []} class="text-xs text-slate-500 hover:text-white transition-colors">Clear All</button>
                </div>

                <!-- Selected/Detected View -->
                {#if selectedIds.length > 0}
                    <div class="flex flex-wrap gap-3 mb-6">
                        {#each selectedTemplateObjects as tmpl}
                            <button
                                on:click={() => toggleTemplate(tmpl.id)}
                                class="group relative flex items-center gap-3 bg-slate-800/50 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-400 text-slate-200 px-4 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                            >
                                <img src={tmpl.iconUrl} alt={tmpl.name} class="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                                <span class="font-medium text-sm">{tmpl.name}</span>
                                <span class="absolute -top-1 -right-1 w-2 h-2 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            </button>
                        {/each}
                    </div>
                {:else}
                     <div class="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl mb-6">
                        Select templates below or detect automatically.
                     </div>
                {/if}

                <!-- Expander for All Templates -->
                <div class="border-t border-white/5 pt-4">
                    <h3 class="text-[10px] uppercase font-bold text-slate-600 mb-3">Available Templates</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                        {#each templates as tmpl}
                            <button
                                on:click={() => toggleTemplate(tmpl.id)}
                                class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all
                                {selectedIds.includes(tmpl.id)
                                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                    : 'bg-slate-950/50 text-slate-500 border border-transparent hover:bg-slate-800'}"
                            >
                                <img src={tmpl.iconUrl} alt="" class="w-3 h-3 opacity-50 grayscale" />
                                {tmpl.name}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

        </div>

        <!-- RIGHT COLUMN: Actions -->
        <div class="flex flex-col gap-6 animate-fade-in-up" style="animation-delay: 0.2s;">

            <!-- SETTINGS CARD -->
            <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 text-slate-300 text-sm font-medium">
                        <span>Splitting Strategy</span>
                    </div>
                    <button on:click={() => settingsOpen = !settingsOpen} class="text-slate-500 hover:text-indigo-400 transition-colors">
                        ⚙
                    </button>
                </div>

                {#if settingsOpen}
                    <div transition:fade class="mt-4 pt-4 border-t border-white/5">
                        <label class="text-xs text-slate-500 uppercase font-bold mb-2 block">Max Characters per File</label>
                        <div class="flex gap-4">
                            <input
                                type="range" min="10000" max="200000" step="5000"
                                bind:value={maxChars}
                                class="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <span class="font-mono text-indigo-400 text-xs bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                                {(maxChars / 1000).toFixed(0)}k
                            </span>
                        </div>
                    </div>
                {:else}
                     <div class="mt-2 text-xs text-slate-500">
                        Auto-splitting files larger than <span class="text-indigo-400">{(maxChars/1000).toFixed(0)}k</span> chars at function boundaries.
                     </div>
                {/if}
            </div>

            <!-- ACTIONS -->
            <div class="grid gap-3">
                <button on:click={() => runForge('root')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 hover:border-indigo-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-1">📁</div>
                        <div class="font-bold text-slate-200 group-hover:text-white">Project Root</div>
                        <div class="text-[10px] text-slate-500">./TXT-Forge</div>
                    </div>
                </button>

                <button on:click={() => runForge('global')} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 hover:border-cyan-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-1">🏦</div>
                        <div class="font-bold text-slate-200 group-hover:text-white">Global Vault</div>
                        <div class="text-[10px] text-slate-500">~/.txt-forge-vault</div>
                    </div>
                </button>

                <button on:click={() => customPathOpen = true} disabled={isProcessing || selectedIds.length === 0}
                    class="group relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 hover:border-emerald-500/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
                    <div class="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="text-xl mb-1">📍</div>
                        <div class="font-bold text-slate-200 group-hover:text-white">Custom Path</div>
                        <div class="text-[10px] text-slate-500">{customPath ? customPath : 'Select destination...'}</div>
                    </div>
                </button>
            </div>
        </div>
    </div>

    <!-- SUCCESS OVERLAY / RESULT -->
    {#if result}
        <div transition:fade class="mt-8 w-full max-w-3xl bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-start gap-4 backdrop-blur-md">
            <div class="bg-emerald-500 rounded-full p-2 text-slate-900">✓</div>
            <div class="flex-1">
                <h3 class="font-bold text-emerald-400 mb-1">Forging Complete!</h3>
                <p class="text-xs text-emerald-200/70 mb-3">Output saved to: {result.outputPath}</p>
                <div class="bg-slate-950/50 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-emerald-400/80">
                    {#each result.files as f}
                        <div>📄 {f}</div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    <!-- CUSTOM PATH MODAL -->
    {#if customPathOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" transition:fade>
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl relative">
                <button on:click={() => customPathOpen = false} class="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                <h3 class="text-xl font-bold text-white mb-4">Where should we save?</h3>
                <p class="text-sm text-slate-400 mb-4">Paste the absolute path to your desired output folder.</p>
                <input
                    type="text"
                    bind:value={customPath}
                    placeholder="C:/Users/Dev/Documents/MyVault..."
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none mb-6"
                    autofocus
                />
                <button
                    on:click={() => runForge('custom')}
                    disabled={!customPath}
                    class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Forge Files Here
                </button>
            </div>
        </div>
    {/if}

    <!-- FOOTER -->
    <div class="mt-auto pt-12 pb-6 text-center">
        <p class="text-[10px] text-slate-600">TXT-FORGE v2.0 • Local Environment</p>
    </div>
</div>