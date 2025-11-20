<script lang="ts">
	import '../app.css';

	// 1. Import the images from your lib folder
	import faviconSvg from '$lib/assets/favicon.svg';
	import faviconPng from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<!-- 2. Inject them into the document head -->
<svelte:head>
	<title>TXT-Forge: Source to Text</title>

	<link rel="icon" href={faviconPng} sizes="any" />
	<link rel="icon" href={faviconSvg} type="image/svg+xml" />
	<link rel="apple-touch-icon" href={faviconPng} />
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
