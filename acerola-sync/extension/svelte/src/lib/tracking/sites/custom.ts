import type { CustomSite } from '$lib/api/types';
import { humanizeSlug, parseProgress, type SiteAdapter } from '../types';

export function customSiteId(site: Pick<CustomSite, 'id'>): string {
	return `custom:${site.id}`;
}

function exec(site: CustomSite, url: URL) {
	try {
		return new RegExp(site.urlPattern).exec(url.href)?.groups ?? null;
	} catch {
		return null;
	}
}

/**
 * Site personalizado: tudo sai da URL, por uma regex com os grupos `id` e `progress` (e
 * `title`, opcional). Ex.: `/obra/(?<id>[^/]+)/capitulo-(?<progress>\d+)`.
 */
export function createCustomAdapter(site: CustomSite): SiteAdapter {
	return {
		id: customSiteId(site),
		name: site.name,
		homepage: site.matchPattern,
		searchUrl: site.searchUrl
			? (title) => site.searchUrl!.replaceAll('{title}', encodeURIComponent(title))
			: undefined,
		mediaType: site.mediaType,
		trigger: site.mediaType === 'ANIME' ? 'video' : 'delay',
		pageKey(url) {
			const groups = exec(site, url);
			return groups?.id && groups.progress ? `${groups.id}/${groups.progress}` : null;
		},
		async detect(url, doc) {
			const groups = exec(site, url);
			if (!groups?.id) return null;
			const progress = parseProgress(groups.progress);
			if (!progress) return null;

			const fromSelector = site.titleSelector
				? doc.querySelector(site.titleSelector)?.textContent?.trim()
				: undefined;
			const title =
				(groups.title && humanizeSlug(groups.title)) ||
				fromSelector ||
				humanizeSlug(groups.id) ||
				doc.title;

			return {
				site: customSiteId(site),
				identifier: groups.id,
				title,
				progress,
				mediaType: site.mediaType,
				url: url.href
			};
		}
	};
}
