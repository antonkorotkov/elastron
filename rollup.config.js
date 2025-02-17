import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import replace from 'rollup-plugin-replace'
import css from 'rollup-plugin-css-only'
import { sveltePreprocess } from 'svelte-preprocess'
import json from '@rollup/plugin-json'

const production = !process.env.ROLLUP_WATCH

export default {
    input: 'src/main.js',
    output: {
        sourcemap: true,
        format: 'iife',
        name: 'app',
        file: 'public/build/bundle.js',
    },
    plugins: [
        json(),

        svelte({
            compilerOptions: {
                dev: !production,
				css: "injected"
            },

            emitCss: false,

            preprocess: sveltePreprocess({
                /* options */
            }),
        }),

        css({ output: 'public/extra.css' }),

        replace({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),

        // If you have external dependencies installed from
        // npm, you'll most likely need these plugins. In
        // some cases you'll need additional configuration -
        // consult the documentation for details:
        // https://github.com/rollup/plugins/tree/master/packages/commonjs
        resolve({
            exportConditions: ['svelte'],
            browser: true,
            dedupe: ['svelte'],
        }),
        commonjs(),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        !production && livereload({ watch: 'public' }),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser(),
    ],
    watch: {
        clearScreen: false,
    },
}

function serve() {
    let started = false

    return {
        writeBundle() {
            if (!started) {
                started = true

                require('child_process').spawn(
                    'npm',
                    ['run', 'start-local', '--', '--dev'],
                    {
                        stdio: ['ignore', 'inherit', 'inherit'],
                        shell: true,
                    }
                )
            }
        },
    }
}
