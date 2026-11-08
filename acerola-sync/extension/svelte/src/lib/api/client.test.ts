import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi, normalizeServerUrl } from './client';

function response(status: number, body?: unknown) {
	return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

describe('api client', () => {
	it('remove a barra final do endereço', () => {
		expect(normalizeServerUrl(' https://sync.acerola.app/ ')).toBe('https://sync.acerola.app');
	});

	it('manda o token de sessão e monta a query', async () => {
		const fetcher = vi.fn().mockResolvedValue(response(200, []));
		const api = createApi('https://srv', 'tok', fetcher);

		await api.search('frieren', 'ANIME', true);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://srv/media/search?q=frieren&mediaType=ANIME&remote=true');
		expect(init.headers.Authorization).toBe('Bearer tok');
	});

	it('transforma o erro do server em ApiError', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(response(401, { errorType: 'unauthorized', message: 'nope' }));
		const api = createApi('https://srv', null, fetcher);

		const error = await api.me().catch((error) => error);
		expect(error).toBeInstanceOf(ApiError);
		expect(error.isUnauthorized).toBe(true);
		expect(error.message).toBe('nope');
	});

	it('marca falha de rede com status 0', async () => {
		const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
		const error = await createApi('https://srv', null, fetcher)
			.health()
			.catch((error) => error);
		expect(error.status).toBe(0);
		expect(error.errorType).toBe('network');
	});

	it('aceita 204 sem corpo', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		await expect(createApi('https://srv', 'tok', fetcher).logout()).resolves.toBeUndefined();
	});
});

describe('api client — sync', () => {
	it('pede a lista inteira só quando full', async () => {
		const fetcher = vi.fn().mockImplementation(async () => response(202, { id: 1 }));
		const api = createApi('https://srv', 'tok', fetcher);

		await api.sync();
		await api.sync(true);
		expect(fetcher.mock.calls[0][0]).toBe('https://srv/sync');
		expect(fetcher.mock.calls[1][0]).toBe('https://srv/sync?full=true');
	});

	it('pede só os logs novos', async () => {
		const fetcher = vi.fn().mockResolvedValue(response(200, { run: {}, logs: [] }));
		await createApi('https://srv', 'tok', fetcher).syncLogs(9, 40);
		expect(fetcher.mock.calls[0][0]).toBe('https://srv/sync/runs/9/logs?after=40');
	});
});

describe('api client — filtros da lista', () => {
	it('manda só os filtros ligados, listas por vírgula', async () => {
		const fetcher = vi.fn().mockImplementation(async () => response(200, []));
		const api = createApi('https://srv', 'tok', fetcher);

		await api.entries({
			mediaType: 'ANIME',
			status: 'CURRENT',
			filters: {
				q: '  frieren ',
				sort: 'score',
				formats: ['TV', 'MOVIE'],
				genres: ['Slice of Life'],
				year: 2023,
				mediaStatuses: []
			},
			limit: 48,
			offset: 0
		});
		const url = new URL(fetcher.mock.calls[0][0]);
		expect(url.pathname).toBe('/entries');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			mediaType: 'ANIME',
			status: 'CURRENT',
			q: 'frieren',
			sort: 'score',
			format: 'TV,MOVIE',
			genre: 'Slice of Life',
			year: '2023',
			limit: '48',
			offset: '0'
		});

		await api.entryCounts({ mediaType: 'MANGA', filters: { sort: 'updated', q: '' } });
		expect(fetcher.mock.calls[1][0]).toBe('https://srv/entries/counts?mediaType=MANGA');
		await api.entryFacets('ANIME');
		expect(fetcher.mock.calls[2][0]).toBe('https://srv/entries/facets?mediaType=ANIME');
	});
});
