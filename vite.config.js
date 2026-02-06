import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import electron from 'vite-plugin-electron/simple'


export default defineConfig({
	plugins: [
		svelte(),
		electron({
			main: {
				entry: 'main.js',
				vite: {
					build: {
						rollupOptions: {
							output: {
								format: 'cjs',
								entryFileNames: '[name].js',
							},
						},
					},
				},
			},
			renderer: {},
		}),
	],
})
