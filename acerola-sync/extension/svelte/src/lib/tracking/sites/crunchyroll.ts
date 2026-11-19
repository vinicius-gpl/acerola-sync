import { parseProgress, pathParts, type DetectedPage, type SiteAdapter } from '../types';

// Episode: https://www.crunchyroll.com[/<language>]/watch/<episode>/<slug>
function episodeId(url: URL): string | null {
	const parts = pathParts(url);
	const index = parts.indexOf('watch');
	return index >= 0 && parts[index + 1] ? parts[index + 1] : null;
}

type JsonLdEpisode = {
	'@type'?: string;
	episodeNumber?: string | number;
	partOfSeason?: { seasonNumber?: string | number; name?: string };
	partOfSeries?: { name?: string; '@id'?: string; url?: string };
};

function readJsonLd(doc: Document): JsonLdEpisode | null {
	for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			const data = JSON.parse(script.textContent ?? '');
			const items: JsonLdEpisode[] = Array.isArray(data) ? data : (data['@graph'] ?? [data]);
			const episode = items.find((item) => item['@type'] === 'TVEpisode');
			if (episode) return episode;
		} catch {
			// Broken JSON-LD: try the next one.
		}
	}
	return null;
}

function seriesIdFrom(href: string | null | undefined): string | null {
	if (!href) return null;
	const match = /\/series\/([^/?#]+)/.exec(href);
	return match ? match[1] : null;
}

function titleWithSeason(series: string, season: number | null): string {
	return season && season > 1 ? `${series} Season ${season}` : series;
}

/**
 * Reads series, season and episode from the page. Tries the JSON-LD (`TVEpisode`) and falls back
 * to the DOM (series link + "E5 - Title" in the header). Each season is a separate media on
 * AniList, so the season goes into the `identifier`.
 */
export function parseCrunchyrollPage(doc: Document, url: URL): DetectedPage | null {
	const jsonLd = readJsonLd(doc);
	const showLink = doc.querySelector<HTMLAnchorElement>('a.show-title-link, a[href*="/series/"]');

	const series =
		jsonLd?.partOfSeries?.name?.trim() ||
		showLink?.querySelector('h4')?.textContent?.trim() ||
		showLink?.textContent?.trim();
	const episode =
		parseProgress(jsonLd?.episodeNumber) ??
		parseProgress(
			/^\s*(?:E|Ep\.?|Episódio|Episode)\s*(\d+)/i.exec(
				doc.querySelector('h1')?.textContent ?? ''
			)?.[1]
		);
	if (!series || !episode) return null;

	const season = parseProgress(jsonLd?.partOfSeason?.seasonNumber);
	const seriesId =
		seriesIdFrom(jsonLd?.partOfSeries?.['@id'] ?? jsonLd?.partOfSeries?.url) ??
		seriesIdFrom(showLink?.getAttribute('href')) ??
		series.toLowerCase();

	return {
		site: 'crunchyroll',
		identifier: `${seriesId}:${season ?? 1}`,
		title: titleWithSeason(series, season),
		progress: episode,
		mediaType: 'ANIME',
		url: url.href
	};
}

// Series: https://www.crunchyroll.com[/<language>]/series/<id>/<slug>
function seriesPageId(url: URL): string | null {
	const parts = pathParts(url);
	const index = parts.indexOf('series');
	return index >= 0 && parts[index + 1] ? parts[index + 1] : null;
}

/**
 * Season chosen in the series page picker ("Season 3", "S3: …", "Temporada 3").
 * Without a picker (single-season series), it is the first one.
 */
export function selectedSeason(doc: Document): number {
	const candidates = doc.querySelectorAll(
		'[class*="seasons-select" i] h4, [class*="season" i] [role="button"], [class*="season" i] h4'
	);
	for (const element of candidates) {
		const match = /(?:^|\s)(?:S|Season|Temporada)\s*(\d+)/i.exec(element.textContent ?? '');
		const season = parseProgress(match?.[1]);
		if (season) return season;
	}
	return 1;
}

export const crunchyroll: SiteAdapter = {
	id: 'crunchyroll',
	name: 'Crunchyroll',
	homepage: 'https://www.crunchyroll.com',
	searchUrl: (title) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`,
	mediaType: 'ANIME',
	trigger: 'video',
	pageKey: episodeId,
	async detect(url, doc) {
		return episodeId(url) ? parseCrunchyrollPage(doc, url) : null;
	},
	async overview(url, doc) {
		const id = seriesPageId(url);
		const title = doc.querySelector('h1')?.textContent?.trim();
		if (!id || !title) return null;
		// The season is the picker's (the page opens on the last one you watched, not the first).
		const season = selectedSeason(doc);
		return {
			site: this.id,
			identifier: `${id}:${season}`,
			title: titleWithSeason(title, season),
			progress: null,
			mediaType: this.mediaType,
			url: url.href
		};
	}
};
