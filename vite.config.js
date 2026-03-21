import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	server: {
		fs: {
			allow: ['.']
		}
	},
	test: {
		environmentMatchGlobs: [
			['**/*.svelte.test.js', 'jsdom']
		]
	}
});
