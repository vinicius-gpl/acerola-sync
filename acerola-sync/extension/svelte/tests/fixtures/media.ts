import type { Entry, EntryWithMedia, Media, SyncLog } from '$lib/api/types';

// Dados de exemplo para testes e stories. Capas ficam nulas de propósito: nada de rede.

export function makeMedia(overrides: Partial<Media> = {}): Media {
	return {
		id: 1,
		idMal: null,
		mediaType: 'ANIME',
		format: 'TV',
		status: 'FINISHED',
		titleRomaji: 'Sousou no Frieren',
		titleEnglish: null,
		titleNative: null,
		titleUserPreferred: 'Sousou no Frieren',
		synonyms: [],
		description: null,
		episodes: 12,
		chapters: null,
		volumes: null,
		duration: 24,
		season: null,
		seasonYear: 2024,
		averageScore: 90,
		genres: ['Adventure'],
		isAdult: false,
		countryOfOrigin: 'JP',
		coverUrl: null,
		coverColor: '#7c3aed',
		bannerUrl: null,
		siteUrl: null,
		nextAiringEpisode: null,
		nextAiringAt: null,
		anilistUpdatedAt: null,
		syncedAt: '2026-11-07T12:00:00Z',
		startYear: 2023,
		source: null,
		studios: [],
		startDate: null,
		endDate: null,
		externalLinks: [],
		relations: [],
		...overrides
	};
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
	return {
		userId: 1,
		mediaId: 1,
		anilistEntryId: 10,
		status: 'CURRENT',
		progress: 3,
		progressVolumes: 0,
		score: 0,
		repeat: 0,
		private: false,
		notes: null,
		startedAt: null,
		completedAt: null,
		anilistUpdatedAt: null,
		updatedAt: '2026-11-07T12:00:00Z',
		dirty: false,
		pushAttempts: 0,
		lastPushError: null,
		...overrides
	};
}

export function makeEntryWithMedia(
	entry: Partial<Entry> = {},
	media: Partial<Media> = {}
): EntryWithMedia {
	const built = makeMedia(media);
	return { ...makeEntry({ mediaId: built.id, ...entry }), media: built };
}

export function makeLog(id: number, message: string, level: SyncLog['level'] = 'INFO'): SyncLog {
	return { id, runId: 1, level, message, createdAt: '2026-11-07T12:00:00Z' };
}
