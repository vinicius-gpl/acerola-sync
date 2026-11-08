import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntryWithMedia } from '../../../tests/fixtures/media';

const api = {
	entries: vi.fn(),
	entryCounts: vi.fn(),
	entryFacets: vi.fn(),
	updateEntry: vi.fn()
};
const push = vi.fn();

vi.mock('$lib/state/app.svelte', () => ({
	app: {
		get api() {
			return api;
		},
		mode: 'popup',
		here: null,
		session: { user: { name: 'vinicius' } },
		push: (...args: unknown[]) => push(...args),
		handleError: vi.fn()
	}
}));

import HomeScreen from './HomeScreen.svelte';

describe('HomeScreen', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		api.entryCounts.mockResolvedValue([
			{ mediaType: 'ANIME', status: 'CURRENT', count: 2 },
			{ mediaType: 'ANIME', status: 'COMPLETED', count: 40 },
			{ mediaType: 'MANGA', status: 'CURRENT', count: 5 }
		]);
		api.entryFacets.mockResolvedValue({ genres: ['Drama'], formats: ['TV'], years: [2024] });
		api.entries.mockResolvedValue([
			makeEntryWithMedia({ progress: 3 }, { id: 1, titleUserPreferred: 'Frieren' }),
			makeEntryWithMedia({ progress: 1 }, { id: 2, titleUserPreferred: 'Dandadan' })
		]);
	});

	it('abre em "assistindo" com o primeiro em destaque', async () => {
		render(HomeScreen);

		expect(await screen.findByText('Dandadan')).toBeInTheDocument();
		expect(api.entries).toHaveBeenCalledWith({
			mediaType: 'ANIME',
			status: 'CURRENT',
			filters: expect.objectContaining({ q: '', sort: 'updated', genres: [] }),
			limit: 48,
			offset: 0
		});
		expect(api.entryFacets).toHaveBeenCalledWith('ANIME');
		expect(document.querySelector('[data-spotlight]')).toHaveTextContent('Frieren');
		expect(screen.getByRole('tab', { name: /Completed|Completo/ })).toHaveTextContent('40');
	});

	it('troca de status e de tipo buscando do espelho', async () => {
		const user = userEvent.setup();
		render(HomeScreen);
		await screen.findByText('Dandadan');

		await user.click(screen.getByRole('tab', { name: /Completed|Completo/ }));
		expect(api.entries).toHaveBeenLastCalledWith(
			expect.objectContaining({ mediaType: 'ANIME', status: 'COMPLETED', offset: 0 })
		);

		await user.click(screen.getByRole('tab', { name: /^Manga|^Mangá/ }));
		expect(api.entries).toHaveBeenLastCalledWith(
			expect.objectContaining({ mediaType: 'MANGA', status: 'COMPLETED', offset: 0 })
		);
	});

	it('filtro vai para o server na lista e na contagem, e tira o destaque', async () => {
		const user = userEvent.setup();
		render(HomeScreen);
		await screen.findByText('Dandadan');

		await user.click(screen.getByRole('button', { name: /Filtros|Filters/ }));
		await user.click(await screen.findByRole('button', { name: 'Drama' }));

		const drama = expect.objectContaining({ genres: ['Drama'] });
		expect(api.entries).toHaveBeenLastCalledWith(
			expect.objectContaining({ filters: drama, offset: 0 })
		);
		expect(api.entryCounts).toHaveBeenLastCalledWith({ mediaType: 'ANIME', filters: drama });
		await vi.waitFor(() => expect(document.querySelector('[data-spotlight]')).toBeNull());

		// Gênero é do tipo: trocar para mangá limpa.
		await user.click(screen.getByRole('tab', { name: /^Manga|^Mangá/ }));
		expect(api.entries).toHaveBeenLastCalledWith(
			expect.objectContaining({
				mediaType: 'MANGA',
				filters: expect.objectContaining({ genres: [] })
			})
		);
	});

	it('+1 que conclui tira o card da aba', async () => {
		const user = userEvent.setup();
		api.updateEntry.mockResolvedValue({
			...makeEntryWithMedia(
				{ progress: 2, status: 'COMPLETED' },
				{ id: 2, titleUserPreferred: 'Dandadan' }
			),
			pending: false
		});
		render(HomeScreen);
		const card = (await screen.findByText('Dandadan')).closest('[data-media-card]') as HTMLElement;

		const buttons = card.querySelectorAll('button');
		await user.click(buttons[buttons.length - 1]);

		expect(api.updateEntry).toHaveBeenCalledWith(2, { progress: 2 });
		await vi.waitFor(() => expect(screen.queryByText('Dandadan')).not.toBeInTheDocument());
	});

	it('página cheia de resultados mostra o fim da grade para carregar mais', async () => {
		api.entries.mockResolvedValue(
			Array.from({ length: 48 }, (_, index) =>
				makeEntryWithMedia({}, { id: index + 1, titleUserPreferred: `Obra ${index + 1}` })
			)
		);
		render(HomeScreen);
		await screen.findByText('Obra 48');
		expect(document.querySelector('[data-sentinel]')).toBeInTheDocument();
	});

	it('mostra a obra da aba aberta no lugar do destaque', async () => {
		const { app } = await import('$lib/state/app.svelte');
		(app as { here: unknown }).here = {
			page: {
				site: 'sakuramangas',
				identifier: 'ruri',
				title: 'RuriDragon',
				progress: null,
				mediaType: 'MANGA',
				url: ''
			},
			resolved: null
		};
		render(HomeScreen);
		expect(await screen.findByText('RuriDragon')).toBeInTheDocument();
		expect(document.querySelector('[data-here]')).toBeInTheDocument();
		(app as { here: unknown }).here = null;
	});
});
