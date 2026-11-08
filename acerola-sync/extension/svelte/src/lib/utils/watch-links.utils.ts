import type { CustomSite, LastVisit, Media } from '$lib/api/types';
import { createCustomAdapter } from '$lib/tracking/sites/custom';
import { BUILT_IN_SITES } from '$lib/tracking/registry';
import type { SiteAdapter } from '$lib/tracking/types';

/**
 * Onde abrir a obra, na ordem em que interessa:
 * - `continue`: a última página em que ela foi marcada em cada site (continuar de onde parou);
 * - `streaming`: links oficiais do AniList (Crunchyroll, Netflix…);
 * - `search`: busca pelo título nos sites rastreados, embutidos e personalizados.
 */
export type WatchLink = {
	key: string;
	kind: 'continue' | 'streaming' | 'search';
	name: string;
	url: string;
	/** Para o favicon. */
	homepage: string;
	progress?: number;
};

function siteName(name: string) {
	return name.trim().toLowerCase();
}

export function watchLinks(
	media: Pick<Media, 'mediaType' | 'titleUserPreferred' | 'titleRomaji' | 'externalLinks'>,
	visits: LastVisit[],
	customSites: CustomSite[] = []
): WatchLink[] {
	const custom = customSites.filter((site) => site.enabled && site.mediaType === media.mediaType);
	const sites: SiteAdapter[] = [
		...BUILT_IN_SITES.filter((site) => site.mediaType === media.mediaType),
		...custom.map(createCustomAdapter)
	];
	const byId = new Map(
		[...BUILT_IN_SITES, ...customSites.map(createCustomAdapter)].map((site) => [site.id, site])
	);

	const links: WatchLink[] = [];
	const seen = new Set<string>();

	for (const visit of visits) {
		const site = byId.get(visit.source);
		const name = site?.name ?? new URL(visit.url).hostname.replace(/^www\./, '');
		seen.add(siteName(name));
		links.push({
			key: `continue:${visit.source}`,
			kind: 'continue',
			name,
			url: visit.url,
			homepage: site?.homepage ?? visit.url,
			progress: visit.progress
		});
	}

	for (const link of media.externalLinks ?? []) {
		if (link.kind !== 'STREAMING' || seen.has(siteName(link.site))) continue;
		seen.add(siteName(link.site));
		links.push({
			key: `streaming:${link.site}`,
			kind: 'streaming',
			name: link.site,
			url: link.url,
			homepage: link.url
		});
	}

	const title = media.titleRomaji || media.titleUserPreferred;
	for (const site of sites) {
		if (!site.searchUrl || seen.has(siteName(site.name))) continue;
		seen.add(siteName(site.name));
		links.push({
			key: `search:${site.id}`,
			kind: 'search',
			name: site.name,
			url: site.searchUrl(title),
			homepage: site.homepage
		});
	}

	return links;
}
