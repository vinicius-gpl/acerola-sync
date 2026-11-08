import { parseProgress, pathParts, type DetectedPage, type SiteAdapter } from '../types';

// Episódio: https://www.crunchyroll.com[/<idioma>]/watch/<episodio>/<slug>
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
			// JSON-LD quebrado: tenta o próximo.
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
 * Lê série, temporada e episódio da página. Tenta o JSON-LD (`TVEpisode`) e cai para o DOM
 * (link da série + "E5 - Título" no cabeçalho). Cada temporada vira uma obra no AniList, então
 * a temporada entra no `identifier`.
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

// Série: https://www.crunchyroll.com[/<idioma>]/series/<id>/<slug>
function seriesPageId(url: URL): string | null {
	const parts = pathParts(url);
	const index = parts.indexOf('series');
	return index >= 0 && parts[index + 1] ? parts[index + 1] : null;
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
		// A página da série abre na primeira temporada.
		return {
			site: this.id,
			identifier: `${id}:1`,
			title,
			progress: null,
			mediaType: this.mediaType,
			url: url.href
		};
	}
};
