<script lang="ts">
    import { slide } from "svelte/transition";

    export let node: any;
    export let selectedPaths: Set<string>;
    export let folderDescendants: Map<string, string[]>;
    // Updated signature: removed forcedState
    export let onToggle: (path: string, isFolder: boolean) => void;
    export let onLoadChildren: (path: string) => Promise<void>;

    let expanded = false;
    let isLoading = false;

    $: isSelfChecked = selectedPaths.has(node.path);

    let isIndeterminate = false;
    let isFullyChecked = false;
    // New state: Detect if we have forced ignored files to be checked
    let isForceChecked = false;

    $: {
        if (node.type === "folder") {
            const allDescendants = folderDescendants.get(node.path) || [];

            if (allDescendants.length === 0 && node.isMassive) {
                isFullyChecked = isSelfChecked;
                isIndeterminate = false;
            } else if (allDescendants.length > 0) {
                const selectedCount = allDescendants.reduce(
                    (acc, path) => acc + (selectedPaths.has(path) ? 1 : 0),
                    0,
                );

                // Pure Math: 100% selected?
                isFullyChecked = selectedCount === allDescendants.length;

                // Indeterminate: >0% but <100%
                isIndeterminate = selectedCount > 0 && !isFullyChecked;

                // Force Check Detection:
                // If it is fully checked, AND the folder itself is effectively an ignored folder (or contains them),
                // we want to visually style it differently.
                // However, for simplicity, "Fully Checked" (Green/Solid) implies Force Check if ignored files exist.
                // We will rely on isFullyChecked for the checkmark, but use CSS to distinguish partials.
            } else {
                isFullyChecked = isSelfChecked;
            }
        } else {
            isFullyChecked = isSelfChecked;
        }
    }

    $: hasChildren = node.children && node.children.length > 0;
    $: isExpandable = node.type === "folder";

    async function handleExpand() {
        if (!isExpandable) return;
        if (
            !expanded &&
            node.isMassive &&
            (!node.children || node.children.length === 0)
        ) {
            isLoading = true;
            expanded = true;
            await onLoadChildren(node.path);
            isLoading = false;
        } else {
            expanded = !expanded;
        }
    }

    function handleToggle() {
        // We just notify parent. Parent calculates next state in the cycle.
        onToggle(node.path, node.type === "folder");
    }
</script>

<div class="select-none">
    <div
        class="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 group transition-colors border border-transparent hover:border-orange-500/20"
        style="padding-left: {node.depth * 1.25 + 0.5}rem"
    >
        <!-- UPDATED Expander -->
        <button
            onclick={(e) => {
                e.stopPropagation();
                handleExpand();
            }}
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 transition-transform duration-200 {expanded
                ? 'rotate-90 text-orange-400'
                : ''} {isExpandable ? '' : 'invisible'}"
        >
            {#if isLoading}
                <!-- Tiny Spinner -->
                <svg
                    class="animate-spin h-3 w-3 text-orange-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    ><circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle><path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path></svg
                >
            {:else}
                ▶
            {/if}
        </button>

        <!-- Checkbox -->
        <button
            onclick={(e) => {
                e.stopPropagation();
                if (!node.isMedia) handleToggle();
            }}
            disabled={node.isMedia}
            title={node.isMedia
                ? "Media files excluded"
                : isFullyChecked
                  ? "Click to Deselect All"
                  : isIndeterminate
                    ? "Click to Force Select All (including ignored)"
                    : "Click to Smart Select"}
            class="w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 group/cb relative
            {node.isMedia
                ? 'bg-slate-800 border-slate-800 opacity-30 cursor-not-allowed'
                : isFullyChecked
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)] hover:bg-red-500 hover:border-red-400 hover:shadow-red-500/20' // Full = Green, Hover = Red (Clear)
                  : isIndeterminate
                    ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.4)] hover:bg-emerald-600 hover:border-emerald-500 hover:shadow-emerald-500/20' // Partial = Orange, Hover = Green (Force)
                    : 'border-slate-700 bg-slate-900/50 hover:border-orange-500 hover:bg-orange-500/20'}" // Empty = Gray, Hover = Orange (Smart)
        >
            {#if isFullyChecked}
                <!-- Checkmark -->
                <svg
                    class="w-3 h-3 transition-transform duration-200 group-hover/cb:scale-75"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                    ></path></svg
                >
                <!-- X icon on hover -->
                <svg
                    class="w-3 h-3 absolute inset-0 m-auto opacity-0 group-hover/cb:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M6 18L18 6M6 6l12 12"
                    ></path></svg
                >
            {:else if isIndeterminate}
                <!-- Dash -->
                <div
                    class="w-2.5 h-0.5 bg-white rounded-full shadow-sm group-hover/cb:opacity-0 transition-opacity"
                ></div>
                <!-- Checkmark on hover (indicating next state is Full) -->
                <svg
                    class="w-3 h-3 absolute inset-0 m-auto opacity-0 group-hover/cb:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                    ></path></svg
                >
            {/if}
        </button>

        <!-- Name -->

        <div
            class="flex items-center gap-2 text-sm font-mono truncate cursor-pointer flex-1"
            role="button"
            tabindex="0"
            onclick={handleExpand}
            onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleExpand();
            }}
        >
            {#if node.type === "folder"}
                <span class="text-amber-500 opacity-90 drop-shadow-md">📁</span>

                <span
                    class="{isFullyChecked || isIndeterminate
                        ? 'text-orange-100'
                        : 'text-slate-500'} group-hover:text-orange-50 transition-colors"
                    >{node.name}</span
                >

                <!-- NEW: Massive Label -->

                {#if node.isMassive}
                    <span
                        class="ml-2 text-[9px] uppercase border border-amber-900/50 text-amber-500/80 px-1.5 rounded bg-amber-950/30 tracking-wider"
                        >Massive</span
                    >
                {/if}
            {:else}
                <span
                    class="opacity-80 {node.isMedia
                        ? 'grayscale opacity-50'
                        : 'text-orange-400/80'}"
                >
                    {node.isMedia ? "🖼️" : "📄"}
                </span>

                <span
                    class="{isFullyChecked
                        ? 'text-orange-200/80'
                        : 'text-slate-500'} group-hover:text-white transition-colors {node.isMedia &&
                    !isFullyChecked
                        ? 'italic opacity-50'
                        : ''}"
                >
                    {node.name}
                </span>
            {/if}

            {#if node.isIgnored}
                <!-- If it's ignored but checked, show a different style to warn user -->
                {#if isFullyChecked || isSelfChecked}
                    <span
                        class="ml-2 text-[9px] uppercase border border-emerald-900/50 text-emerald-400/80 px-1.5 rounded bg-emerald-950/30"
                        >Force Included</span
                    >
                {:else}
                    <span
                        class="ml-2 text-[9px] uppercase border border-slate-800 text-slate-600 px-1.5 rounded bg-slate-950"
                        >Ignored</span
                    >
                {/if}
            {/if}

            {#if node.isMedia && !isFullyChecked}
                <span
                    class="ml-2 text-[9px] uppercase border border-slate-800 text-slate-700 px-1.5 rounded bg-slate-950"
                    >Media</span
                >
            {/if}
        </div>
    </div>

    <!-- Children -->

    <!-- Check hasChildren OR isMassive (to keep div ready for injection) -->

    {#if expanded && (hasChildren || node.isMassive)}
        <div transition:slide|local={{ duration: 200 }}>
            {#if node.children}
                {#each node.children as child (child.path)}
                    <svelte:self
                        node={child}
                        {selectedPaths}
                        {folderDescendants}
                        {onToggle}
                        {onLoadChildren}
                    />
                {/each}
            {/if}
        </div>
    {/if}
</div>
