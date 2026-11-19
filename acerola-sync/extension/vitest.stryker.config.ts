import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'path';
import { defineConfig } from 'vitest/config';
import svg from '@poppanator/sveltekit-svg';

// Lean config used only by Stryker (stryker.conf.json): mutation testing only makes sense for
// the `unit` project (pure logic in .ts/.svelte.ts). The `integration`/`storybook` projects of
// the main vitest.config.ts use a real browser through Playwright, which would only make each
// mutant slower to run without adding relevant mutation signal.
export default defineConfig({
	plugins: [
		svelte({
			hot: false,
			compilerOptions: {
				dev: true
			}
		}),
		svg({
			includePaths: ['./svelte/src/lib/assets/'],
			svgoOptions: {
				multipass: true,
				plugins: ['preset-default']
			}
		}),
		svelteTesting()
	],
	optimizeDeps: {
		include: [
			'aria-query',
			'axobject-query',
			'lz-string',
			'dom-accessibility-api',
			'pretty-format',
			'picocolors'
		]
	},
	resolve: {
		alias: {
			$lib: path.resolve('./svelte/src/lib'),
			$theme: path.resolve('./svelte/src/theme')
		},
		conditions: ['browser', 'svelte', 'development'],
		// Stryker runs from a copied sandbox with node_modules SYMLINKED back to the real
		// project (.stryker-tmp/sandbox*): without this Vite/Rolldown resolves the symlinks to
		// the real path outside the sandbox and breaks the tsconfig lookup during dependency
		// optimization ("Tsconfig not found" when resolving 'node:module').
		preserveSymlinks: true
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['svelte/src/**/*.test.ts'],
		exclude: ['svelte/src/**/*.browser.test.ts'],
		setupFiles: ['svelte/tests/setup.ts']
	}
});
