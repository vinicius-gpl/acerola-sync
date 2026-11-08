import type { EntryStatus, MediaType } from '$lib/api/types';
import { m } from '$lib/paraglide/messages';

/** Nome do status no idioma da tela; "assistindo" ou "lendo" conforme o tipo. */
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
	return mediaType === 'ANIME' ? m['sync.media_type.anime']() : m['sync.media_type.manga']();
}

const FORMAT_LABELS: Record<string, () => string> = {
	TV: m['sync.filters.format_tv'],
	TV_SHORT: m['sync.filters.format_tv_short'],
	MOVIE: m['sync.filters.format_movie'],
	SPECIAL: m['sync.filters.format_special'],
	OVA: m['sync.filters.format_ova'],
	ONA: m['sync.filters.format_ona'],
	MUSIC: m['sync.filters.format_music'],
	MANGA: m['sync.filters.format_manga'],
	NOVEL: m['sync.filters.format_novel'],
	ONE_SHOT: m['sync.filters.format_one_shot']
};

const MEDIA_STATUS_LABELS: Record<string, () => string> = {
	RELEASING: m['sync.filters.status_releasing'],
	FINISHED: m['sync.filters.status_finished'],
	NOT_YET_RELEASED: m['sync.filters.status_not_yet_released'],
	HIATUS: m['sync.filters.status_hiatus'],
	CANCELLED: m['sync.filters.status_cancelled']
};

const SEASON_LABELS: Record<string, () => string> = {
	WINTER: m['sync.media.season_winter'],
	SPRING: m['sync.media.season_spring'],
	SUMMER: m['sync.media.season_summer'],
	FALL: m['sync.media.season_fall']
};

const RELATION_LABELS: Record<string, () => string> = {
	SEQUEL: m['sync.media.relation_sequel'],
	PREQUEL: m['sync.media.relation_prequel'],
	SOURCE: m['sync.media.relation_source'],
	ADAPTATION: m['sync.media.relation_adaptation'],
	SIDE_STORY: m['sync.media.relation_side_story'],
	SPIN_OFF: m['sync.media.relation_spin_off'],
	ALTERNATIVE: m['sync.media.relation_alternative'],
	SUMMARY: m['sync.media.relation_summary'],
	PARENT: m['sync.media.relation_parent'],
	CHARACTER: m['sync.media.relation_character'],
	COMPILATION: m['sync.media.relation_compilation'],
	CONTAINS: m['sync.media.relation_contains'],
	OTHER: m['sync.media.relation_other']
};

/** `LIGHT_NOVEL` → `Light novel`: para valores do AniList sem tradução. */
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
