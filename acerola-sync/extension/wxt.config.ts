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
	manifest: ({ browser }) => ({
		name: 'Acerola Sync',
		description: 'Lista, lançamentos e tracking de anime e mangá sincronizados com o AniList.',
		// Ícones gerados do `acerola.svg` (o mesmo do acerola-reader). O Chrome não aceita SVG
		// no manifest, então vão em PNG; dentro do popup o logo continua sendo o SVG.
		icons: {
			16: 'icon/16.png',
			32: 'icon/32.png',
			48: 'icon/48.png',
			96: 'icon/96.png',
			128: 'icon/128.png'
		},
		action: { default_title: 'Acerola Sync' },
		// storage: tema e sessão · identity: OAuth do AniList · scripting: sites personalizados ·
		// favicon (só Chrome): ícone dos sites nos ajustes, vindo do cache do navegador.
		permissions: [
			'storage',
			'identity',
			'scripting',
			...(browser === 'firefox' ? [] : ['favicon'])
		],
		// Sites embutidos (content scripts) e a API do MangaDex.
		host_permissions: [
			'*://*.sakuramangas.org/*',
			'*://sakuramangas.org/*',
			'*://mangadex.org/*',
			'*://*.mangadex.org/*',
			'*://*.crunchyroll.com/*',
			'*://*.netflix.com/*'
		],
		// Ícone do botão fixo que o content script põe na página do site (inclusive nos sites
		// personalizados, que podem ser qualquer domínio).
		web_accessible_resources: [{ resources: ['icon/96.png'], matches: ['<all_urls>'] }],
		// Server e sites personalizados: pedidos na hora, só para o domínio cadastrado.
		optional_host_permissions: ['https://*/*', 'http://*/*']
	}),
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
