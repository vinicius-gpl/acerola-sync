import { browser } from 'wxt/browser';

/** Origin of a URL or match pattern (`https://*.site.com/*` → `https://site.com`). */
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
 * Site favicon. On Chrome it comes from the browser's own cache (`/_favicon/`, `favicon`
 * permission), with no request to the site or third parties. On Firefox, which lacks this API,
 * it falls back to the site's `/favicon.ico`.
 */
export function faviconUrl(urlOrPattern: string, size = 64): string | null {
	const origin = siteOrigin(urlOrPattern);
	if (!origin) return null;

	if (import.meta.env.FIREFOX) return `${origin}/favicon.ico`;
	const params = new URLSearchParams({ pageUrl: origin, size: String(size) });
	// `/_favicon/` is not an extension file, so it is not among WXT's typed paths.
	const getURL = browser.runtime.getURL as (path: string) => string;
	return getURL(`/_favicon/?${params}`);
}
