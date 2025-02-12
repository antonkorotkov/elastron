import js from "@eslint/js";
import eslintPluginSvelte from 'eslint-plugin-svelte';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
        ...js.configs.recommended,
        files: ["src/**/*.js", "app/**/*.js"]
    },
	...eslintPluginSvelte.configs['flat/recommended']
];
