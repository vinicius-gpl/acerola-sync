import { describe, expect, it } from 'vitest';
import type { CustomSite } from '$lib/api/types';
import { watchLinks } from './watch-links.utils';

const anime = {
	mediaType: 'ANIME' as const,
	titleUserPreferred: 'Sousou no Frieren',
	titleRomaji: 'Sousou no Frieren',
	externalLinks: [
		{
			site: 'Crunchyroll',
			url: 'https://www.crunchyroll.com/series/x',
			kind: 'STREAMING',
			language: null
		},
		{ site: 'Twitter', url: 'https://x.com/frieren', kind: 'SOCIAL', language: null }
	]
};

const customSite = (patch: Partial<CustomSite> = {}): CustomSite => ({
	id: '9',
	name: 'Meu player',
	mediaType: 'ANIME',
	matchPattern: 'https://player.exemplo.com/*',
	urlPattern: '/v/(?<id>[^/]+)/(?<progress>\\d+)',
	titleSelector: null,
	enabled: true,
	searchUrl: 'https://player.exemplo.com/busca?q={title}',
	...patch
});

describe('watchLinks', () => {
	it('continuar primeiro, depois streaming oficial, depois busca nos sites', () => {
		const links = watchLinks(
			anime,
			[
				{ source: 'custom:9', url: 'https://player.exemplo.com/v/fr/7', progress: 7, createdAt: '' }
			],
			[customSite()]
		);
		expect(links.map((link) => [link.kind, link.name])).toEqual([
			['continue', 'Meu player'],
			['streaming', 'Crunchyroll'],
			['search', 'Netflix']
		]);
		expect(links[0].progress).toBe(7);
		expect(links[2].url).toBe('https://www.netflix.com/search?q=Sousou%20no%20Frieren');
	});

	it('site personalizado com busca entra; desligado ou de outro tipo, não', () => {
		const names = (sites: CustomSite[]) =>
			watchLinks({ ...anime, externalLinks: [] }, [], sites).map((link) => link.name);
		expect(names([customSite()])).toContain('Meu player');
		expect(names([customSite({ enabled: false })])).not.toContain('Meu player');
		expect(names([customSite({ mediaType: 'MANGA' })])).not.toContain('Meu player');
		expect(names([customSite({ searchUrl: null })])).not.toContain('Meu player');
		expect(
			watchLinks({ ...anime, externalLinks: [] }, [], [customSite()]).find(
				(link) => link.name === 'Meu player'
			)?.url
		).toBe('https://player.exemplo.com/busca?q=Sousou%20no%20Frieren');
	});

	it('mangá busca no MangaDex; visita de site desconhecido usa o domínio', () => {
		const links = watchLinks(
			{
				mediaType: 'MANGA',
				titleUserPreferred: 'Chainsaw Man',
				titleRomaji: null,
				externalLinks: []
			},
			[{ source: 'outro', url: 'https://www.leitor.com/csm/231', progress: 231, createdAt: '' }]
		);
		expect(links.map((link) => link.name)).toEqual(['leitor.com', 'MangaDex']);
	});
});
