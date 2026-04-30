import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter(),
        alias: {
            $store: 'src/store',
            $components: 'src/components',
            $utils: 'src/utils',
            $api: 'src/api' // Keeping for reference, though we want to deprecate IPC
        }
    },
    preprocess: vitePreprocess()
};

export default config;
