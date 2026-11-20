import { browser } from 'wxt/browser';

/** Brand files served by the acerola-brand CDN (the same ones the brand book publishes). */
export const BRAND_CDN = 'https://cdn.acerola.app/brand';

export type BrandAsset = 'logo' | 'mascot';

const CDN_PATHS: Record<BrandAsset, string> = {
	logo: `${BRAND_CDN}/logo/acerola-logo-foreground.svg`,
	mascot: `${BRAND_CDN}/mascot/acerola-mascot.svg`
};

/** Copies shipped with the extension, used when the CDN is down or the site's CSP blocks it. */
const LOCAL_PATHS: Record<BrandAsset, '/brand/acerola-logo.svg' | '/brand/acerola-mascot.svg'> = {
	logo: '/brand/acerola-logo.svg',
	mascot: '/brand/acerola-mascot.svg'
};

export function brandUrl(asset: BrandAsset): string {
	return CDN_PATHS[asset];
}

export function brandFallbackUrl(asset: BrandAsset): string {
	try {
		return browser.runtime.getURL(LOCAL_PATHS[asset]);
	} catch {
		// Outside the extension (tests, Storybook): no packaged copy to point at.
		return LOCAL_PATHS[asset];
	}
}

/** Loads the asset from the CDN and switches to the packaged copy if it fails. */
export function loadBrandImage(img: HTMLImageElement, asset: BrandAsset) {
	const fallback = brandFallbackUrl(asset);
	img.addEventListener(
		'error',
		() => {
			if (img.src !== fallback) img.src = fallback;
		},
		{ once: true }
	);
	img.src = brandUrl(asset);
}
