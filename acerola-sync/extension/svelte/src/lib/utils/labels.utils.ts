import type { EntryStatus, MediaType } from '$lib/api/types';
import { m } from '$lib/paraglide/messages';

/** Status name in the screen language; "watching" or "reading" depending on the type. */
export function statusLabel(status: EntryStatus, mediaType: MediaType): string {
	const anime = mediaType === 'ANIME';
	switch (status) {
		case 'CURRENT':
			return anime ? m['sync.status.watching']() : m['sync.status.reading']();
		case 'REPEATING':
			return anime ? m['sync.status.rewatching']() : m['sync.status.rereading']();
		case 'PLANNING':
			return m['sync.status.planning']();
		case 'COMPLETED':
			return m['sync.status.completed']();
		case 'PAUSED':
			return m['sync.status.paused']();
		case 'DROPPED':
			return m['sync.status.dropped']();
	}
}

export function mediaTypeLabel(mediaType: MediaType): string {
	return mediaType === 'ANIME' ? m['sync.media.type.anime']() : m['sync.media.type.manga']();
}

const FORMAT_LABELS: Record<string, () => string> = {
	TV: m['sync.filters.format.tv'],
	TV_SHORT: m['sync.filters.format.tvShort'],
	MOVIE: m['sync.filters.format.movie'],
	SPECIAL: m['sync.filters.format.special'],
	OVA: m['sync.filters.format.ova'],
	ONA: m['sync.filters.format.ona'],
	MUSIC: m['sync.filters.format.music'],
	MANGA: m['sync.filters.format.manga'],
	NOVEL: m['sync.filters.format.novel'],
	ONE_SHOT: m['sync.filters.format.oneShot']
};

const MEDIA_STATUS_LABELS: Record<string, () => string> = {
	RELEASING: m['sync.filters.status.releasing'],
	FINISHED: m['sync.filters.status.finished'],
	NOT_YET_RELEASED: m['sync.filters.status.notYetReleased'],
	HIATUS: m['sync.filters.status.hiatus'],
	CANCELLED: m['sync.filters.status.cancelled']
};

const SEASON_LABELS: Record<string, () => string> = {
	WINTER: m['sync.media.season.winter'],
	SPRING: m['sync.media.season.spring'],
	SUMMER: m['sync.media.season.summer'],
	FALL: m['sync.media.season.fall']
};

const RELATION_LABELS: Record<string, () => string> = {
	SEQUEL: m['sync.media.relation.sequel'],
	PREQUEL: m['sync.media.relation.prequel'],
	SOURCE: m['sync.media.relation.source'],
	ADAPTATION: m['sync.media.relation.adaptation'],
	SIDE_STORY: m['sync.media.relation.sideStory'],
	SPIN_OFF: m['sync.media.relation.spinOff'],
	ALTERNATIVE: m['sync.media.relation.alternative'],
	SUMMARY: m['sync.media.relation.summary'],
	PARENT: m['sync.media.relation.parent'],
	CHARACTER: m['sync.media.relation.character'],
	COMPILATION: m['sync.media.relation.compilation'],
	CONTAINS: m['sync.media.relation.contains'],
	OTHER: m['sync.media.relation.other']
};

/** `LIGHT_NOVEL` → `Light novel`: for AniList values with no translation. */
export function humanizeEnum(value: string): string {
	const text = value.replace(/_/g, ' ').toLowerCase();
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function label(map: Record<string, () => string>, value: string) {
	return map[value]?.() ?? humanizeEnum(value);
}

export const formatLabel = (format: string) => label(FORMAT_LABELS, format);
export const mediaStatusLabel = (status: string) => label(MEDIA_STATUS_LABELS, status);
export const seasonLabel = (season: string) => label(SEASON_LABELS, season);
export const relationLabel = (relation: string) => label(RELATION_LABELS, relation);
