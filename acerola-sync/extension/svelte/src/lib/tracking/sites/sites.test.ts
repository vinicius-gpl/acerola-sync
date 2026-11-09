import { describe, expect, it, vi } from 'vitest';
import { parseProgress } from '../types';
import { createCustomAdapter } from './custom';
import { crunchyroll, parseCrunchyrollPage } from './crunchyroll';
import { createMangadex, parseMangadexChapter } from './mangadex';
import { netflix, parseNetflixPlayer } from './netflix';
import { sakuraMangas } from './sakuramangas';

function page(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html');
}

describe('parseProgress', () => {
	it('lê o número do capítulo', () => {
		expect(parseProgress('11')).toBe(11);
		expect(parseProgress('11.5')).toBe(11);
		expect(parseProgress('Capítulo 7')).toBe(7);
		expect(parseProgress('0')).toBeNull();
		expect(parseProgress(null)).toBeNull();
	});
});

describe('sakuraMangas', () => {
	it('reconhece a página do capítulo', async () => {
		const url = new URL('https://sakuramangas.org/obras/chainsaw-man/11/');
		expect(sakuraMangas.pageKey(url)).toBe('chainsaw-man/11');

		const detected = await sakuraMangas.detect(url, page('<h1 id="id-titulo"> Chainsaw Man </h1>'));
		expect(detected).toMatchObject({
			site: 'sakuramangas',
			identifier: 'chainsaw-man',
			title: 'Chainsaw Man',
			progress: 11,
			mediaType: 'MANGA'
		});
	});

	it('usa o slug quando a página não tem título', async () => {
		const detected = await sakuraMangas.detect(
			new URL('https://sakuramangas.org/obras/one-piece/1100/'),
			page('')
		);
		expect(detected?.title).toBe('one piece');
	});

	it('ignora a página da obra', () => {
		expect(
			sakuraMangas.pageKey(new URL('https://sakuramangas.org/obras/chainsaw-man/'))
		).toBeNull();
	});
});

describe('mangadex', () => {
	const chapter = {
		data: {
			id: 'chap-1',
			attributes: { chapter: '42.5' },
			relationships: [
				{ id: 'group', type: 'scanlation_group' },
				{
					id: 'manga-uuid',
					type: 'manga',
					attributes: {
						title: { en: 'Dandadan' },
						originalLanguage: 'ja',
						links: { al: '132029', mal: '135496' }
					}
				}
			]
		}
	};

	it('usa o ID do AniList informado pelo MangaDex', () => {
		expect(parseMangadexChapter(chapter, 'https://mangadex.org/chapter/chap-1')).toMatchObject({
			identifier: 'manga-uuid',
			title: 'Dandadan',
			progress: 42,
			anilistId: 132029
		});
	});

	it('trata oneshot como capítulo 1', () => {
		const oneshot = structuredClone(chapter);
		oneshot.data.attributes.chapter = null as unknown as string;
		expect(parseMangadexChapter(oneshot, '')?.progress).toBe(1);
	});

	it('busca o capítulo na API', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(chapter)));
		const adapter = createMangadex(fetcher);
		const url = new URL('https://mangadex.org/chapter/chap-1/3');

		expect(adapter.pageKey(url)).toBe('chap-1');
		await adapter.detect(url, page(''));
		expect(fetcher).toHaveBeenCalledWith(
			'https://api.mangadex.org/chapter/chap-1?includes[]=manga'
		);
	});
});

describe('crunchyroll', () => {
	const url = new URL('https://www.crunchyroll.com/pt-br/watch/GX9UQE0WJ/the-journeys-end');

	it('lê o episódio pelo JSON-LD', () => {
		const doc = page(
			`<script type="application/ld+json">${JSON.stringify({
				'@type': 'TVEpisode',
				episodeNumber: '5',
				partOfSeason: { seasonNumber: '2' },
				partOfSeries: {
					name: 'Frieren',
					'@id': 'https://www.crunchyroll.com/series/GG5H5XQX4/frieren'
				}
			})}</script>`
		);

		expect(crunchyroll.pageKey(url)).toBe('GX9UQE0WJ');
		expect(parseCrunchyrollPage(doc, url)).toMatchObject({
			identifier: 'GG5H5XQX4:2',
			title: 'Frieren Season 2',
			progress: 5
		});
	});

	it('cai para o DOM sem JSON-LD', () => {
		const doc = page(
			'<a class="show-title-link" href="/series/GG5H5XQX4/frieren"><h4>Frieren</h4></a><h1>E3 - Killing Magic</h1>'
		);
		expect(parseCrunchyrollPage(doc, url)).toMatchObject({
			identifier: 'GG5H5XQX4:1',
			title: 'Frieren',
			progress: 3
		});
	});

	it('espera a página carregar', () => {
		expect(parseCrunchyrollPage(page(''), url)).toBeNull();
	});
});

describe('netflix', () => {
	const url = new URL('https://www.netflix.com/watch/81234567');

	it('lê temporada e episódio do player', () => {
		const doc = page(
			'<div data-uia="video-title"><h4>Kaiju No. 8</h4><span>T2:E4</span><span>Título</span></div>'
		);
		expect(netflix.pageKey(url)).toBe('81234567');
		expect(parseNetflixPlayer(doc, url)).toMatchObject({
			identifier: 'kaiju no. 8:2',
			title: 'Kaiju No. 8 Season 2',
			progress: 4
		});
	});

	it('ignora filme e player sem controles', () => {
		expect(
			parseNetflixPlayer(page('<div data-uia="video-title"><h4>Filme</h4></div>'), url)
		).toBeNull();
		expect(parseNetflixPlayer(page(''), url)).toBeNull();
	});

	it('só marca o que já está na lista', () => {
		expect(netflix.requireListMatch).toBe(true);
	});
});

describe('custom', () => {
	const site = {
		id: '7',
		name: 'Leitor',
		mediaType: 'MANGA' as const,
		matchPattern: 'https://leitor.exemplo.com/*',
		urlPattern: '/obra/(?<id>[^/]+)/capitulo-(?<progress>\\d+)',
		titleSelector: 'h1.titulo',
		enabled: true
	};

	it('tira obra e capítulo da URL', async () => {
		const adapter = createCustomAdapter(site);
		const url = new URL('https://leitor.exemplo.com/obra/blue-lock/capitulo-250');

		expect(adapter.id).toBe('custom:7');
		expect(adapter.pageKey(url)).toBe('blue-lock/250');
		expect(await adapter.detect(url, page('<h1 class="titulo">Blue Lock</h1>'))).toMatchObject({
			site: 'custom:7',
			identifier: 'blue-lock',
			title: 'Blue Lock',
			progress: 250
		});
	});

	it('não quebra com regex inválida', () => {
		const adapter = createCustomAdapter({ ...site, urlPattern: '(' });
		expect(adapter.pageKey(new URL('https://leitor.exemplo.com/obra/x/capitulo-1'))).toBeNull();
	});

	describe('número fora da URL (Kuro Mangás)', () => {
		const kuro = {
			...site,
			id: '9',
			matchPattern: 'https://kuromangas.com/*',
			urlPattern: '/read/(?<id>\\d+)/\\d+',
			titleSelector: 'header p.truncate',
			progressSource: 'title' as const,
			progressPattern: 'Cap\\.\\s*(?<progress>\\d+(?:\\.\\d+)?)'
		};
		const chapter = (number: number) =>
			page(
				`<title>Cap. ${number} — O Santuário - Masmorra da Torre - Kuro</title><header><p class="truncate">Masmorra da Torre</p></header>`
			);

		it('lê o número do título da página e a obra da URL', async () => {
			const adapter = createCustomAdapter(kuro);
			const url = new URL('https://kuromangas.com/read/2507/463111');
			expect(adapter.pageKey(url)).toBe('2507/read/2507/463111');
			expect(await adapter.detect(url, chapter(30))).toMatchObject({
				identifier: '2507',
				title: 'Masmorra da Torre',
				progress: 30
			});
		});

		it('lê de um elemento quando a fonte é o seletor', async () => {
			const adapter = createCustomAdapter({
				...kuro,
				progressSource: 'selector',
				progressSelector: 'header span',
				progressPattern: null
			});
			const doc = page('<title>Kuro</title><header><span>Cap. 12</span></header>');
			expect(
				await adapter.detect(new URL('https://kuromangas.com/read/2507/1'), doc)
			).toMatchObject({ progress: 12 });
		});

		it('sem o número na página ainda, devolve null para o runner tentar de novo', async () => {
			const adapter = createCustomAdapter(kuro);
			const url = new URL('https://kuromangas.com/read/2507/463111');
			expect(await adapter.detect(url, page('<title>Kuro</title>'))).toBeNull();
		});

		it('SPA: número igual ao da página anterior só vale depois de repetir', async () => {
			const adapter = createCustomAdapter(kuro);
			await adapter.detect(new URL('https://kuromangas.com/read/2507/1'), chapter(30));
			const next = new URL('https://kuromangas.com/read/2507/2');
			expect(await adapter.detect(next, chapter(30))).toBeNull();
			expect(await adapter.detect(next, chapter(31))).toMatchObject({ progress: 31 });

			const third = new URL('https://kuromangas.com/read/2507/3');
			expect(await adapter.detect(third, chapter(31))).toBeNull();
			expect(await adapter.detect(third, chapter(31))).toBeNull();
			expect(await adapter.detect(third, chapter(31))).toMatchObject({ progress: 31 });
		});
	});
});

describe('páginas de obra', () => {
	it('Sakura Mangás reconhece a página da obra', async () => {
		const page = await sakuraMangas.overview!(
			new URL('https://sakuramangas.org/obras/ruridragon/'),
			new DOMParser().parseFromString('<h1 class="h1-titulo">RuriDragon</h1>', 'text/html')
		);
		expect(page).toMatchObject({ identifier: 'ruridragon', title: 'RuriDragon', progress: null });
		expect(
			await sakuraMangas.overview!(
				new URL('https://sakuramangas.org/obras/ruridragon/51/'),
				page_()
			)
		).toBeNull();
	});

	it('MangaDex usa a API da obra', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: { id: 'm1', attributes: { title: { en: 'Dandadan' }, links: { al: '132029' } } }
				})
			)
		);
		const page = await createMangadex(fetcher).overview!(
			new URL('https://mangadex.org/title/m1/dandadan'),
			page_()
		);
		expect(fetcher).toHaveBeenCalledWith('https://api.mangadex.org/manga/m1');
		expect(page).toMatchObject({ identifier: 'm1', anilistId: 132029, progress: null });
	});

	it('Crunchyroll usa a primeira temporada da série', async () => {
		const page = await crunchyroll.overview!(
			new URL('https://www.crunchyroll.com/pt-br/series/GG5H5XQX4/frieren'),
			new DOMParser().parseFromString('<h1>Frieren</h1>', 'text/html')
		);
		expect(page).toMatchObject({ identifier: 'GG5H5XQX4:1', title: 'Frieren' });
	});
});

function page_() {
	return new DOMParser().parseFromString('', 'text/html');
}
