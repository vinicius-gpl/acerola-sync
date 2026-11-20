import { browser } from 'wxt/browser';

/**
 * Logo and mascot shipped with the extension (copies of the acerola-brand files in
 * `static/brand/`). Never loaded from the brand CDN: the app is open source and self-hosted, so it
 * must not depend on, or spend, someone else's CDN.
 */
export type BrandAsset = 'logo' | 'mascot';

const PATHS: Record<BrandAsset, '/brand/acerola-logo.svg' | '/brand/acerola-mascot.svg'> = {
	logo: '/brand/acerola-logo.svg',
	mascot: '/brand/acerola-mascot.svg'
};

export function brandUrl(asset: BrandAsset): string {
	try {
		return browser.runtime.getURL(PATHS[asset]);
	} catch {
		// Outside the extension (tests, Storybook): served from the static folder.
		return PATHS[asset];
	}
}
