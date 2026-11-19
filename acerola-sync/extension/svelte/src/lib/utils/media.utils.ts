import type { Entry, EntryWithMedia, Media } from '$lib/api/types';
import { latestAired } from '$lib/services/airing.service';

/** Total episodes (anime) or chapters (manga), when AniList knows. */
export function totalUnits(media: Media): number | null {
	return media.mediaType === 'ANIME' ? media.episodes : media.chapters;
}

/** `3/12`, or just `3` when the total is unknown. */
export function progressLabel(entry: Pick<Entry, 'progress'>, media: Media): string {
	const total = totalUnits(media);
	return total ? `${entry.progress}/${total}` : String(entry.progress);
}

/**
 * Episodes already aired of an airing anime (`null` otherwise). Counts the next one as aired
 * when its time has passed and the mirror has not updated yet.
 */
export function airedCount(media: Media, now = Date.now()): number | null {
	return latestAired(media, now);
}

/** Episodes already aired and not yet watched (only makes sense for airing anime). */
export function behindCount(
	entry: Pick<Entry, 'progress'>,
	media: Media,
	now = Date.now()
): number {
	const aired = airedCount(media, now);
	return aired ? Math.max(0, aired - entry.progress) : 0;
}

/** Does not go past the last aired episode or the total, like AniMouto. */
export function canIncrement(
	entry: Pick<Entry, 'progress'>,
	media: Media,
	now = Date.now()
): boolean {
	const total = totalUnits(media);
	if (total && entry.progress >= total) return false;
	if (media.nextAiringEpisode && entry.progress + 1 > (airedCount(media, now) ?? 0)) return false;
	return true;
}

/** Percentage for the card's small bar (0–100), or `undefined` with no total. */
export function progressPercent(entry: Pick<Entry, 'progress'>, media: Media): number | undefined {
	const total = totalUnits(media);
	return total ? Math.min(100, (entry.progress / total) * 100) : undefined;
}

/** Splits the list like AniMouto: airing (by next episode), anime and manga. */
export function splitList(entries: EntryWithMedia[]) {
	const anime = entries.filter((entry) => entry.media.mediaType === 'ANIME');
	const airing = anime
		.filter((entry) => entry.media.status === 'RELEASING' && entry.media.nextAiringAt)
		.sort(
			(a, b) =>
				Date.parse(a.media.nextAiringAt ?? '') - Date.parse(b.media.nextAiringAt ?? '')
		);
	const airingIds = new Set(airing.map((entry) => entry.mediaId));

	return {
		airing,
		watching: anime.filter((entry) => !airingIds.has(entry.mediaId)),
		reading: entries.filter((entry) => entry.media.mediaType === 'MANGA')
	};
}
