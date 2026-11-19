import type { MediaType } from '$lib/api/types';

/** What an adapter found on the page: which media (on the site) and which episode/chapter. */
export type DetectedPage = {
	site: string;
	/** Media ID on the site (slug, uuid…). Together with `site`, it is the mapping key. */
	identifier: string;
	title: string;
	progress: number;
	mediaType: MediaType;
	/** When the site itself gives the AniList ID (MangaDex does). */
	anilistId?: number | null;
	url: string;
};

/** Page open in the tab: chapter/episode (`progress`) or just the media page (`null`). */
export type CurrentPage = Omit<DetectedPage, 'progress'> & { progress: number | null };

/**
 * `delay`: marks after a few seconds on the page (manga chapter).
 * `video`: marks when the video passes 85% (anime episode).
 */
export type TrackTrigger = 'delay' | 'video';

/**
 * A trackable site. Inspired by MALSync's `pages`, but only with what Acerola uses: the
 * adapter identifies the page; the server decides whether the progress counts.
 */
export type SiteAdapter = {
	id: string;
	name: string;
	/** Site home page, where the favicon on the settings screen comes from. */
	homepage: string;
	/** Site search by title (the media's "open on site" button). */
	searchUrl?(title: string): string;
	mediaType: MediaType;
	trigger: TrackTrigger;
	/**
	 * Only marks if the media is already in the list or was linked by hand. Netflix mixes anime
	 * with everything else; without this, any series would become a similar anime on AniList.
	 */
	requireListMatch?: boolean;
	/** Key of the open episode/chapter; `null` when the page is not a reading/video page. */
	pageKey(url: URL): string | null;
	/** `null` when the page has not loaded what it needs yet; the runner tries again. */
	detect(url: URL, doc: Document): Promise<DetectedPage | null>;
	/** Media page (no chapter/episode): the popup shows the media when opened on it. */
	overview?(url: URL, doc: Document): Promise<CurrentPage | null>;
};

export function pathParts(url: URL): string[] {
	return url.pathname.split('/').filter(Boolean);
}

/** `chainsaw-man` → `chainsaw man`, to use as the title when the page has none. */
export function humanizeSlug(slug: string): string {
	return decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** `11`, `11.5`, `Capítulo 11` → 11. An extra chapter (`.5`) counts as the integer below. */
export function parseProgress(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const match = /\d+(?:[.,]\d+)?/.exec(String(value));
	if (!match) return null;
	const number = Math.floor(Number(match[0].replace(',', '.')));
	return Number.isFinite(number) && number > 0 ? number : null;
}
