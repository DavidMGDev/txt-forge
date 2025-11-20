<script lang="ts">
    import { slide } from 'svelte/transition';
    export let node: any;
    export let selectedPaths: Set<string>;
    export let onToggle: (path: string, isFolder: boolean, forcedState?: boolean) => void;

    // State
    let expanded = false;
    // Derived
    $: isChecked = selectedPaths.has(node.path);
    $: hasChildren = node.children && node.children.length > 0;
    $: isExpandable = hasChildren && node.depth < 7;
    function handleToggle() {
        onToggle(node.path, node.type === 'folder', !isChecked);
    }
</script>

<div class="select-none">
    <div
        class="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 group transition-colors border border-transparent hover:border-orange-500/20"
        style="padding-left: {(node.depth * 1.25) + 0.5}rem"
    >

        <!-- Expander Arrow -->
        <button
            on:click={() => expanded = !expanded}
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 transition-transform duration-200 {expanded ? 'rotate-90 text-orange-400' : ''} {isExpandable ? '' : 'invisible'}"
        >
            ▶
        </button>

        <!-- Checkbox -->
        <button
            on:click={handleToggle}
            class="w-4 h-4 rounded border flex items-center justify-center transition-all
            {isChecked
                ? 'bg-orange-600 border-orange-600 text-white shadow-[0_0_10px_rgba(2ea,88,12,0.4)]'
                : 'border-slate-700 bg-slate-900/50 hover:border-orange-500/50'}"
        >
            {#if isChecked}
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            {/if}
        </button>

        <!-- Icon & Name -->
        <div class="flex items-center gap-2 text-sm font-mono truncate cursor-pointer" on:click={() => isExpandable ? expanded = !expanded : handleToggle()}>
            {#if node.type === 'folder'}
                <span class="text-amber-500 opacity-90 drop-shadow-md">📁</span>
                <span class="{isChecked ? 'text-orange-100' : 'text-slate-500'} group-hover:text-orange-50 transition-colors">{node.name}</span>
            {:else}
                <span class="text-orange-400/80 opacity-80">📄</span>
                <span class="{isChecked ? 'text-orange-200/80' : 'text-slate-500'} group-hover:text-white transition-colors">{node.name}</span>
            {/if}

            {#if node.isIgnored && !isChecked}
                <span class="ml-2 text-[9px] uppercase border border-slate-800 text-slate-600 px-1.5 rounded bg-slate-950">Ignored</span>
            {/if}
        </div>
    </div>

    <!-- Children -->
    {#if expanded && hasChildren}
        <div transition:slide|local={{ duration: 200 }}>
            {#each node.children as child (child.path)}
                <svelte:self
                    node={child}
                    {selectedPaths}
                    {onToggle}
                />
            {/each}
        </div>
    {/if}
</div>