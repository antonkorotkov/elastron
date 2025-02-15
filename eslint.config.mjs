import globals from 'globals'
import js from "@eslint/js"
import eslintPluginSvelte from 'eslint-plugin-svelte'

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
        ...js.configs.recommended,
        files: ["src/**/*.js", "app/**/*.js"],
		languageOptions: { globals: { ...globals.node, ...globals.browser } }
    },
	...eslintPluginSvelte.configs['flat/recommended']
]
