import {
	parseProgress,
	pathParts,
	type CurrentPage,
	type DetectedPage,
	type SiteAdapter
} from '../types';

type LocalizedString = Record<string, string>;

export type MangadexChapterResponse = {
	data: {
		id: string;
		attributes: { chapter: string | null };
		relationships: {
			id: string;
			type: string;
			attributes?: {
				title?: LocalizedString;
				altTitles?: LocalizedString[];
				originalLanguage?: string;
				links?: Record<string, string> | null;
			};
		}[];
	};
};

function pickTitle(title: LocalizedString = {}, originalLanguage = 'ja'): string {
	return (
		title[`${originalLanguage}-ro`] ??
		title.en ??
		title[originalLanguage] ??
		Object.values(title)[0] ??
		''
	);
}

/** O MangaDex já diz o ID do AniList em `links.al`: nesse caso não precisa buscar título. */
export function parseMangadexChapter(
	response: MangadexChapterResponse,
	url: string
): DetectedPage | null {
	const manga = response.data.relationships.find((relation) => relation.type === 'manga');
	if (!manga) return null;

	// Oneshot não tem número de capítulo.
	const progress = parseProgress(response.data.attributes.chapter) ?? 1;
	const anilistId = Number(manga.attributes?.links?.al);

	return {
		site: 'mangadex',
		identifier: manga.id,
		title: pickTitle(manga.attributes?.title, manga.attributes?.originalLanguage),
		progress,
		mediaType: 'MANGA',
		anilistId: Number.isInteger(anilistId) && anilistId > 0 ? anilistId : null,
		url
	};
}

// Capítulo: https://mangadex.org/chapter/<uuid>[/<pagina>]
function chapterId(url: URL): string | null {
	const [section, id] = pathParts(url);
	return section === 'chapter' && id ? id : null;
}

type MangadexMangaResponse = {
	data: {
		id: string;
		attributes: {
			title?: LocalizedString;
			originalLanguage?: string;
			links?: Record<string, string> | null;
		};
	};
};

/** Página da obra: o mesmo título e o mesmo `links.al` do capítulo. */
export function parseMangadexManga(response: MangadexMangaResponse, url: string): CurrentPage {
	const attributes = response.data.attributes;
	const anilistId = Number(attributes.links?.al);
	return {
		site: 'mangadex',
		identifier: response.data.id,
		title: pickTitle(attributes.title, attributes.originalLanguage),
		progress: null,
		mediaType: 'MANGA',
		anilistId: Number.isInteger(anilistId) && anilistId > 0 ? anilistId : null,
		url
	};
}

// Obra: https://mangadex.org/title/<uuid>[/<slug>]
function titleId(url: URL): string | null {
	const [section, id] = pathParts(url);
	return section === 'title' && id && id !== 'random' ? id : null;
}

export function createMangadex(fetcher: typeof fetch = (...args) => fetch(...args)): SiteAdapter {
	return {
		id: 'mangadex',
		name: 'MangaDex',
		homepage: 'https://mangadex.org',
		searchUrl: (title) => `https://mangadex.org/search?q=${encodeURIComponent(title)}`,
		mediaType: 'MANGA',
		trigger: 'delay',
		pageKey: chapterId,
		async detect(url) {
			const id = chapterId(url);
			if (!id) return null;
			const response = await fetcher(`https://api.mangadex.org/chapter/${id}?includes[]=manga`);
			if (!response.ok) return null;
			return parseMangadexChapter(await response.json(), url.href);
		},
		async overview(url) {
			const id = titleId(url);
			if (!id) return null;
			const response = await fetcher(`https://api.mangadex.org/manga/${id}`);
			if (!response.ok) return null;
			return parseMangadexManga(await response.json(), url.href);
		}
	};
}

export const mangadex = createMangadex();
