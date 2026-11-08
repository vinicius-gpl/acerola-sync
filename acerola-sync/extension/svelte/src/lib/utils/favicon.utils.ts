import { browser } from 'wxt/browser';

/** Endereço de origem de uma URL ou match pattern (`https://*.site.com/*` → `https://site.com`). */
export function siteOrigin(urlOrPattern: string): string | null {
	const cleaned = urlOrPattern
		.trim()
		.replace(/^\*:\/\//, 'https://')
		.replace('://*.', '://');
	try {
		const url = new URL(cleaned.replace(/\*+/g, ''));
		return /^https?:$/.test(url.protocol) ? url.origin : null;
	} catch {
		return null;
	}
}

/**
 * Favicon do site. No Chrome vem do cache do próprio navegador (`/_favicon/`, permissão
 * `favicon`) — sem request para o site nem para terceiros. No Firefox, que não tem essa API,
 * cai no `/favicon.ico` do site.
 */
export function faviconUrl(urlOrPattern: string, size = 64): string | null {
	const origin = siteOrigin(urlOrPattern);
	if (!origin) return null;

	if (import.meta.env.FIREFOX) return `${origin}/favicon.ico`;
	const params = new URLSearchParams({ pageUrl: origin, size: String(size) });
	// `/_favicon/` não é um arquivo da extensão, então não entra nos caminhos tipados do WXT.
	const getURL = browser.runtime.getURL as (path: string) => string;
	return getURL(`/_favicon/?${params}`);
}
