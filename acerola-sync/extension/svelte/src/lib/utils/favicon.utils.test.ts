import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
	browser: { runtime: { getURL: (path: string) => `chrome-extension://abc${path}` } }
}));

import { faviconUrl, siteOrigin } from './favicon.utils';

describe('favicon.utils', () => {
	it('tira a origem de URL e de match pattern', () => {
		expect(siteOrigin('https://sakuramangas.org/obras/x/1')).toBe('https://sakuramangas.org');
		expect(siteOrigin('*://*.crunchyroll.com/*')).toBe('https://crunchyroll.com');
		expect(siteOrigin('https://leitor.exemplo.com/*')).toBe('https://leitor.exemplo.com');
		expect(siteOrigin('não é url')).toBeNull();
	});

	it('usa o cache de favicon do Chrome', () => {
		expect(faviconUrl('https://mangadex.org/title/x', 32)).toBe(
			'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fmangadex.org&size=32'
		);
		expect(faviconUrl('lixo')).toBeNull();
	});
});
