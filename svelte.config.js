import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
            // Keeps the build clean and self-contained
            out: 'build',
            precompress: false,
            envPrefix: ''
        })
	}
};

export default config;
