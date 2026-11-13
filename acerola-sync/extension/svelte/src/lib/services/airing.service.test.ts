import { describe, expect, it } from 'vitest';
import type { EntryWithMedia } from '$lib/api/types';
import { addNotifications, checkAiring, latestAired, NOTIFICATIONS_KEPT } from './airing.service';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const HOUR = 3_600_000;

function entry(
	mediaId: number,
	progress: number,
	nextAiringEpisode: number | null,
	nextAiringAt: string | null,
	mediaType: 'ANIME' | 'MANGA' = 'ANIME'
) {
	return {
		mediaId,
		progress,
		media: {
			mediaType,
			titleUserPreferred: `Obra ${mediaId}`,
			coverUrl: null,
			nextAiringEpisode,
			nextAiringAt
		}
	} as unknown as EntryWithMedia;
}

describe('latestAired', () => {
	it('é o anterior ao próximo, ou o próprio próximo se a hora dele já passou', () => {
		const future = new Date(NOW + HOUR).toISOString();
		const past = new Date(NOW - HOUR).toISOString();
		expect(latestAired({ nextAiringEpisode: 8, nextAiringAt: future }, NOW)).toBe(7);
		expect(latestAired({ nextAiringEpisode: 8, nextAiringAt: past }, NOW)).toBe(8);
		expect(latestAired({ nextAiringEpisode: 1, nextAiringAt: future }, NOW)).toBeNull();
		expect(latestAired({ nextAiringEpisode: null, nextAiringAt: null }, NOW)).toBeNull();
	});
});

describe('checkAiring', () => {
	const future = new Date(NOW + HOUR).toISOString();

	it('primeira conferência só monta a base, sem avisar da lista atrasada', () => {
		const result = checkAiring([entry(1, 3, 8, future), entry(2, 7, 8, future)], {}, NOW);
		expect(result.fresh).toEqual([]);
		expect(result.behind).toBe(1);
		expect(result.seen).toEqual({ 1: 7, 2: 7 });
	});

	it('avisa o episódio que saiu desde a última conferência', () => {
		const result = checkAiring([entry(1, 7, 9, future)], { 1: 7 }, NOW);
		expect(result.fresh).toEqual([{ mediaId: 1, title: 'Obra 1', episode: 8, cover: null }]);
		expect(result.behind).toBe(1);
		expect(result.seen).toEqual({ 1: 8 });
	});

	it('não avisa o que você já assistiu nem repete o mesmo episódio', () => {
		expect(checkAiring([entry(1, 8, 9, future)], { 1: 7 }, NOW).fresh).toEqual([]);
		expect(checkAiring([entry(1, 7, 9, future)], { 1: 8 }, NOW).fresh).toEqual([]);
	});

	it('ignora mangá e anime sem próximo episódio', () => {
		const result = checkAiring(
			[entry(1, 0, 5, future, 'MANGA'), entry(2, 3, null, null)],
			{ 1: 1, 2: 1 },
			NOW
		);
		expect(result).toEqual({ behind: 0, fresh: [], seen: {} });
	});
});

describe('addNotifications', () => {
	const episode = (mediaId: number, ep: number) => ({
		mediaId,
		title: `Obra ${mediaId}`,
		episode: ep,
		cover: null
	});

	it('põe o novo no topo, sem ler, com o id da notificação do sistema', () => {
		const first = addNotifications([], [episode(1, 4)], NOW);
		const next = addNotifications(first, [episode(2, 7)], NOW + HOUR);
		expect(next.map((item) => item.id)).toEqual(['airing:2:7', 'airing:1:4']);
		expect(next[0]).toMatchObject({ read: false, at: new Date(NOW + HOUR).toISOString() });
	});

	it('não repete o mesmo episódio e guarda só os últimos', () => {
		const again = addNotifications(
			addNotifications([], [episode(1, 4)], NOW),
			[episode(1, 4)],
			NOW
		);
		expect(again).toHaveLength(1);

		const many = Array.from({ length: NOTIFICATIONS_KEPT + 5 }, (_, i) => episode(i + 1, 1));
		const kept = addNotifications([], many, NOW);
		expect(kept).toHaveLength(NOTIFICATIONS_KEPT);
		expect(kept[0].mediaId).toBe(1);
	});
});
