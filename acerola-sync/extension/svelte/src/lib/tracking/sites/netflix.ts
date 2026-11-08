import { parseProgress, pathParts, type DetectedPage, type SiteAdapter } from '../types';

// Episódio: https://www.netflix.com/watch/<id>
function videoId(url: URL): string | null {
	const [section, id] = pathParts(url);
	return section === 'watch' && id ? id : null;
}

/**
 * O player da Netflix mostra `<h4>Série</h4><span>T1:E5</span>` (ou `S1:E5`) no título do
 * vídeo enquanto os controles estão visíveis. Filme não tem episódio e é ignorado.
 */
export function parseNetflixPlayer(doc: Document, url: URL): DetectedPage | null {
	const container = doc.querySelector('[data-uia="video-title"]');
	if (!container) return null;

	const series = container.querySelector('h4')?.textContent?.trim();
	const match = /(?:T|S)(\d+)\s*:\s*E(\d+)/i.exec(container.textContent ?? '');
	if (!series || !match) return null;

	const season = parseProgress(match[1]) ?? 1;
	const episode = parseProgress(match[2]);
	if (!episode) return null;

	return {
		site: 'netflix',
		identifier: `${series.toLowerCase()}:${season}`,
		title: season > 1 ? `${series} Season ${season}` : series,
		progress: episode,
		mediaType: 'ANIME',
		url: url.href
	};
}

export const netflix: SiteAdapter = {
	id: 'netflix',
	name: 'Netflix',
	homepage: 'https://www.netflix.com',
	searchUrl: (title) => `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
	mediaType: 'ANIME',
	trigger: 'video',
	requireListMatch: true,
	pageKey: videoId,
	async detect(url, doc) {
		return videoId(url) ? parseNetflixPlayer(doc, url) : null;
	}
};
