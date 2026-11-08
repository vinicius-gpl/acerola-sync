import type { EntryWithMedia, Media } from '$lib/api/types';
import { describe, expect, it } from 'vitest';
import { behindCount, canIncrement, progressLabel, splitList } from './media.utils';

function media(overrides: Partial<Media> = {}): Media {
	return {
		id: 1,
		mediaType: 'ANIME',
		episodes: 12,
		chapters: null,
		status: 'FINISHED',
		nextAiringEpisode: null,
		nextAiringAt: null,
		titleUserPreferred: 'Obra',
		...overrides
	} as Media;
}

function entry(mediaId: number, overrides: Partial<Media>, progress = 0): EntryWithMedia {
	return { mediaId, progress, media: media({ id: mediaId, ...overrides }) } as EntryWithMedia;
}

describe('media.utils', () => {
	it('mostra o progresso com o total quando existe', () => {
		expect(progressLabel({ progress: 3 }, media())).toBe('3/12');
		expect(progressLabel({ progress: 3 }, media({ episodes: null }))).toBe('3');
		expect(progressLabel({ progress: 50 }, media({ mediaType: 'MANGA', chapters: 100 }))).toBe(
			'50/100'
		);
	});

	it('conta os episódios atrasados', () => {
		expect(behindCount({ progress: 3 }, media({ nextAiringEpisode: 6 }))).toBe(2);
		expect(behindCount({ progress: 5 }, media({ nextAiringEpisode: 6 }))).toBe(0);
		expect(behindCount({ progress: 5 }, media())).toBe(0);
	});

	it('não deixa passar do lançado nem do total', () => {
		expect(canIncrement({ progress: 5 }, media({ nextAiringEpisode: 6 }))).toBe(false);
		expect(canIncrement({ progress: 4 }, media({ nextAiringEpisode: 6 }))).toBe(true);
		expect(canIncrement({ progress: 12 }, media())).toBe(false);
		expect(canIncrement({ progress: 99 }, media({ episodes: null }))).toBe(true);
	});

	it('separa lançando, anime e mangá', () => {
		const list = splitList([
			entry(1, { status: 'RELEASING', nextAiringAt: '2026-11-09T00:00:00Z' }),
			entry(2, { status: 'RELEASING', nextAiringAt: '2026-11-08T00:00:00Z' }),
			entry(3, {}),
			entry(4, { mediaType: 'MANGA' })
		]);
		expect(list.airing.map((item) => item.mediaId)).toEqual([2, 1]);
		expect(list.watching.map((item) => item.mediaId)).toEqual([3]);
		expect(list.reading.map((item) => item.mediaId)).toEqual([4]);
	});
});
