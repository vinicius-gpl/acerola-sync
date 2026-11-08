import type { StorybookConfig } from '@storybook/svelte-vite';
import svg from '@poppanator/sveltekit-svg';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
	stories: ['../svelte/src/**/*.mdx', '../svelte/src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs'
	],
	framework: '@storybook/svelte-vite',
	staticDirs: ['../svelte/static'],
	viteFinal(config) {
		// Sem SvelteKit e sem vite.config.ts (o build é do WXT), os plugins entram aqui — ANTES
		// dos do Storybook, senão o svelte-docgen tenta ler o .svelte ainda não compilado.
		const projectConfig = {
			plugins: [
				svelte(),
				tailwindcss(),
				svg({
					includePaths: ['./svelte/src/lib/assets/'],
					svgoOptions: { multipass: true, plugins: ['preset-default'] }
				})
			],
			resolve: {
				alias: {
					$lib: path.resolve('./svelte/src/lib'),
					$theme: path.resolve('./svelte/src/theme')
				}
			}
		};

		return mergeConfig(
			projectConfig,
			mergeConfig(config, {
				server: {
					fs: {
						allow: [path.resolve('svelte/src/theme')]
					}
				},
				optimizeDeps: {
					entries: ['../svelte/src/**/*.stories.@(js|ts|svelte)', '../svelte/src/**/*.svelte'],
					holdUntilResolved: true,
					include: [
						'svelte',
						'svelte/internal',
						'svelte/internal/client',
						'svelte/internal/disclose-version',
						'esm-env',
						'devalue',
						'tailwind-merge',
						'tailwind-variants',
						'svelte-sonner',
						'bits-ui',
						'mode-watcher',
						'clsx',
						'@internationalized/date',
						'aria-query',
						'axobject-query',
						'lz-string',
						'dom-accessibility-api',
						'pretty-format',
						'picocolors'
					],
					exclude: ['@lucide/svelte']
				}
			})
		);
	}
};

export default config;
