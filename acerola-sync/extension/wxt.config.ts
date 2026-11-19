import { paraglideVitePlugin } from '@inlang/paraglide-js';
import svg from '@poppanator/sveltekit-svg';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Same layout as acerola-reader: the whole frontend lives in `svelte/`.
export default defineConfig({
	srcDir: 'svelte/src',
	publicDir: 'svelte/static',
	modules: ['@wxt-dev/module-svelte'],
	// Explicit imports, like in the reader: no WXT auto-import.
	imports: false,
	alias: {
		$lib: 'svelte/src/lib',
		$theme: 'svelte/src/theme'
	},
	manifest: ({ browser }) => ({
		name: 'Acerola Sync',
		description: 'Lista, lançamentos e tracking de anime e mangá sincronizados com o AniList.',
		// Icons generated from `acerola.svg` (the same as acerola-reader). Chrome does not accept
		// SVG in the manifest, so they go as PNG; inside the popup the logo is still the SVG.
		icons: {
			16: 'icon/16.png',
			32: 'icon/32.png',
			48: 'icon/48.png',
			96: 'icon/96.png',
			128: 'icon/128.png'
		},
		action: { default_title: 'Acerola Sync' },
		// Fixed id on any PC: Chrome derives the id from the public key in `key`. It comes from
		// EXTENSION_PUBLIC_KEY, derived at build time from the private key stored in the
		// EXTENSION_KEY secret (release) or in 1Password (`mise run build:extension`). Without it,
		// the id depends on the folder. On Firefox the fixed id is `gecko.id`.
		...(browser === 'firefox'
			? { browser_specific_settings: { gecko: { id: 'acerola-sync@acerola.app' } } }
			: process.env.EXTENSION_PUBLIC_KEY
				? { key: process.env.EXTENSION_PUBLIC_KEY }
				: {}),
		// storage: theme and session · identity: AniList OAuth · scripting: custom sites ·
		// favicon (Chrome only): site icons in settings, from the browser cache.
		permissions: [
			'storage',
			'identity',
			'scripting',
			// alarms + notifications: check for new episodes and notify through the system.
			'alarms',
			'notifications',
			...(browser === 'firefox' ? [] : ['favicon'])
		],
		// Built-in sites (content scripts) and the MangaDex API.
		host_permissions: [
			'*://*.sakuramangas.org/*',
			'*://sakuramangas.org/*',
			'*://mangadex.org/*',
			'*://*.mangadex.org/*',
			'*://*.crunchyroll.com/*',
			'*://*.netflix.com/*'
		],
		// Icon of the floating button the content script puts on the site page (custom sites
		// included, which can be any domain).
		web_accessible_resources: [{ resources: ['icon/96.png'], matches: ['<all_urls>'] }],
		// Server and custom sites: requested on demand, only for the registered domain.
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
				// An extension page has no reliable cookie: the language lives in localStorage.
				strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
			})
		]
	})
});
