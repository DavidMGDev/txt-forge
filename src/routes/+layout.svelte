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
            background-color: #0f172a; /* Slate 900 */
            color-scheme: dark;
        }

        /* Webkit (Chrome, Safari, Edge) scrollbar customization */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        ::-webkit-scrollbar-track {
            background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 5px;
            border: 2px solid #0f172a;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }
    </style>
</svelte:head>

{@render children()}
