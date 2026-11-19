/**
 * Checks a URL against an extension match pattern (`https://*.site.com/*`). Used to find which
 * custom site applies to the open tab.
 */
export function matchesPattern(pattern: string, href: string): boolean {
	if (pattern === '<all_urls>') return /^https?:/.test(href);

	const match = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern.trim());
	if (!match) return false;
	const [, scheme, host, path] = match;

	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return false;
	}

	const protocol = url.protocol.replace(':', '');
	if (scheme === '*' ? !['http', 'https'].includes(protocol) : scheme !== protocol) return false;

	if (host !== '*') {
		if (host.startsWith('*.')) {
			const domain = host.slice(2);
			if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return false;
		} else if (url.hostname !== host) {
			return false;
		}
	}

	const pathRegex = new RegExp(
		`^${path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
	);
	return pathRegex.test(url.pathname + url.search);
}

/** Origin to request the site permission for (`https://site.com/*`). */
export function originPattern(pattern: string): string | null {
	const match = /^(\*|https?):\/\/([^/]+)\//.exec(pattern.trim());
	return match ? `${match[1]}://${match[2]}/*` : null;
}
