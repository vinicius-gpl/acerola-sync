import { paraglideVitePlugin } from '@inlang/paraglide-js';
import svg from '@poppanator/sveltekit-svg';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Mesmo layout do acerola-reader: tudo do frontend mora em `svelte/`.
export default defineConfig({
	srcDir: 'svelte/src',
	publicDir: 'svelte/static',
	modules: ['@wxt-dev/module-svelte'],
	// Imports explícitos, como no reader — nada de auto-import do WXT.
	imports: false,
	alias: {
		$lib: 'svelte/src/lib',
		$theme: 'svelte/src/theme'
	},
	manifest: {
		name: 'Acerola Sync',
		description: 'Lista, lançamentos e tracking de anime e mangá sincronizados com o AniList.',
		permissions: ['storage']
	},
	vite: () => ({
		plugins: [
			tailwindcss(),
			svg({
				includePaths: ['./svelte/src/lib/assets/'],
				svgoOptions: {
					multipass: true,
					plugins: ['preset-default']
				}
			}),
			paraglideVitePlugin({
				project: './svelte/project.inlang',
				outdir: './svelte/src/lib/paraglide',
				// Página de extensão não tem cookie confiável: o idioma fica no localStorage.
				strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
			})
		]
	})
});
