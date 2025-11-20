<script lang="ts">

    import { slide } from 'svelte/transition';

    export let node: any;

    export let selectedPaths: Set<string>;

    // NEW PROP

    export let folderDescendants: Map<string, string[]>;

    export let onToggle: (path: string, isFolder: boolean, forcedState?: boolean) => void;

    // State

    let expanded = false;

    // --- UPDATED LOGIC ---

    

    // 1. Am I checked explicitly?

    $: isSelfChecked = selectedPaths.has(node.path);

    // 2. Calculate descendants status to determine Indeterminate state

    let isIndeterminate = false;

    let isFullyChecked = false;

    $: {

        if (node.type === 'folder') {

            // folderDescendants contains all children (files and folders)

            const allDescendants = folderDescendants.get(node.path) || [];

            

            if (allDescendants.length > 0) {

                // Count how many are currently in selectedPaths

                const selectedCount = allDescendants.reduce((acc, path) => {

                    return acc + (selectedPaths.has(path) ? 1 : 0);

                }, 0);

                

                // If self is checked, we add 1

                const totalSelected = selectedCount + (isSelfChecked ? 1 : 0);

                // Total items = descendants + self

                const totalItems = allDescendants.length + 1;

                // Indeterminate if we have some, but not all

                isIndeterminate = totalSelected > 0 && totalSelected < totalItems;

                isFullyChecked = totalSelected === totalItems;

            } else {

                // Empty folder

                isFullyChecked = isSelfChecked;

                isIndeterminate = false;

            }

        } else {

            // It is a file

            isFullyChecked = isSelfChecked;

            isIndeterminate = false;

        }

    }

    $: hasChildren = node.children && node.children.length > 0;

    $: isExpandable = hasChildren && node.depth < 7;

    function handleToggle() {

        // If currently indeterminate, we want to select ALL (force true)

        // If currently checked, we want to unselect ALL (force false)

        // If unchecked, select ALL

        const nextState = isIndeterminate ? true : !isSelfChecked;

        onToggle(node.path, node.type === 'folder', nextState);

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
            on:click|stopPropagation={handleToggle}
            class="w-4 h-4 rounded border flex items-center justify-center transition-all
            {isFullyChecked || isIndeterminate
                ? 'bg-orange-600 border-orange-600 text-white shadow-[0_0_10px_rgba(2ea,88,12,0.4)]'
                : 'border-slate-700 bg-slate-900/50 hover:border-orange-500/50'}"
        >
            {#if isFullyChecked}
                <!-- Checkmark -->
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            {:else if isIndeterminate}
                <!-- Indeterminate Dash -->
                <div class="w-2.5 h-0.5 bg-white rounded-full"></div>
            {/if}
        </button>

        <!-- Icon & Name -->
        <div class="flex items-center gap-2 text-sm font-mono truncate cursor-pointer flex-1" on:click={() => isExpandable ? expanded = !expanded : handleToggle()}>
            {#if node.type === 'folder'}
                <span class="text-amber-500 opacity-90 drop-shadow-md">📁</span>
                <span class="{isFullyChecked || isIndeterminate ? 'text-orange-100' : 'text-slate-500'} group-hover:text-orange-50 transition-colors">{node.name}</span>
            {:else}
                <span class="opacity-80 {node.isMedia ? 'grayscale opacity-50' : 'text-orange-400/80'}">
                    {node.isMedia ? '🖼️' : '📄'}
                </span>
                <span class="{isFullyChecked ? 'text-orange-200/80' : 'text-slate-500'} group-hover:text-white transition-colors {node.isMedia && !isFullyChecked ? 'italic opacity-50' : ''}">
                    {node.name}
                </span>
            {/if}
            {#if node.isIgnored && !isFullyChecked}
                <span class="ml-2 text-[9px] uppercase border border-slate-800 text-slate-600 px-1.5 rounded bg-slate-950">Ignored</span>
            {/if}
            <!-- Media Label -->
            {#if node.isMedia && !isFullyChecked}
                <span class="ml-2 text-[9px] uppercase border border-slate-800 text-slate-700 px-1.5 rounded bg-slate-950">Media</span>
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
                    {folderDescendants}
                    {onToggle}
                />
            {/each}
        </div>
    {/if}
</div>