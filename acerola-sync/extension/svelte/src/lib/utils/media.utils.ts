import type { Entry, EntryWithMedia, Media } from '$lib/api/types';
import { latestAired } from '$lib/services/airing.service';

/** Total de episódios (anime) ou capítulos (mangá), quando o AniList sabe. */
export function totalUnits(media: Media): number | null {
	return media.mediaType === 'ANIME' ? media.episodes : media.chapters;
}

/** `3/12`, ou só `3` quando o total é desconhecido. */
export function progressLabel(entry: Pick<Entry, 'progress'>, media: Media): string {
	const total = totalUnits(media);
	return total ? `${entry.progress}/${total}` : String(entry.progress);
}

/**
 * Episódios já lançados de um anime em lançamento (`null` fora disso). Conta o próximo como
 * lançado quando a hora dele já passou e o espelho ainda não atualizou.
 */
export function airedCount(media: Media, now = Date.now()): number | null {
	return latestAired(media, now);
}

/** Episódios já lançados e ainda não vistos (só faz sentido para anime em lançamento). */
export function behindCount(
	entry: Pick<Entry, 'progress'>,
	media: Media,
	now = Date.now()
): number {
	const aired = airedCount(media, now);
	return aired ? Math.max(0, aired - entry.progress) : 0;
}

/** Não deixa passar do último episódio lançado nem do total, como o AniMouto. */
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

/** Percentual para a barrinha do card (0–100), ou `undefined` sem total. */
export function progressPercent(entry: Pick<Entry, 'progress'>, media: Media): number | undefined {
	const total = totalUnits(media);
	return total ? Math.min(100, (entry.progress / total) * 100) : undefined;
}

/** Divide a lista como o AniMouto: lançando (por próximo episódio), anime e mangá. */
export function splitList(entries: EntryWithMedia[]) {
	const anime = entries.filter((entry) => entry.media.mediaType === 'ANIME');
	const airing = anime
		.filter((entry) => entry.media.status === 'RELEASING' && entry.media.nextAiringAt)
		.sort(
			(a, b) => Date.parse(a.media.nextAiringAt ?? '') - Date.parse(b.media.nextAiringAt ?? '')
		);
	const airingIds = new Set(airing.map((entry) => entry.mediaId));

	return {
		airing,
		watching: anime.filter((entry) => !airingIds.has(entry.mediaId)),
		reading: entries.filter((entry) => entry.media.mediaType === 'MANGA')
	};
}
