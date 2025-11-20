<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
    <style>
        /* Global dark scrollbar fix for the entire app */
        :global(html) {
            background-color: #020617; /* Slate 950 (Void) */
            color-scheme: dark;
        }

        /* Webkit (Chrome, Safari, Edge) scrollbar customization */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        ::-webkit-scrollbar-track {
            background: #020617;
        }
        ::-webkit-scrollbar-thumb {
            background: #334155; /* Slate 700 */
            border-radius: 5px;
            border: 2px solid #020617;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #f97316; /* Orange 500 (Magma) */
        }
    </style>
</svelte:head>

{@render children()}
