import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import { makeEntry, makeMedia } from '../../../tests/fixtures/media';

const api = {
	media: vi.fn(),
	syncEntry: vi.fn(),
	updateEntry: vi.fn(),
	deleteEntry: vi.fn()
};

vi.mock('wxt/browser', () => ({
	browser: { runtime: { getURL: (path: string) => `chrome-extension://acerola${path}` } }
}));
vi.mock('wxt/utils/storage', () => ({ storage: { getItem: vi.fn(async () => []) } }));

vi.mock('$lib/state/app.svelte', () => ({
	app: {
		get api() {
			return api;
		},
		mode: 'popup',
		back: vi.fn(),
		push: vi.fn(),
		handleError: vi.fn()
	}
}));

import MediaScreen from './MediaScreen.svelte';

async function openWithEntry() {
	api.media.mockResolvedValue({
		media: makeMedia(),
		entry: makeEntry({ progress: 3 }),
		visits: []
	});
	render(MediaScreen, { props: { mediaId: 1 } });
	await screen.findByRole('heading', { level: 1, name: 'Sousou no Frieren' });
}

describe('MediaScreen', () => {
	beforeEach(() => {
		api.media.mockReset();
		api.updateEntry.mockReset();
		api.deleteEntry.mockReset();
	});

	it('remover fecha o diálogo e não deixa a tela presa', async () => {
		const user = userEvent.setup();
		api.deleteEntry.mockResolvedValue(undefined);
		await openWithEntry();

		await user.click(screen.getByRole('button', { name: /Remove from list|Remover da lista/ }));
		const dialog = await screen.findByRole('alertdialog');
		await user.click(
			[...dialog.querySelectorAll('button')].find((button) =>
				/Remove from list|Remover da lista/.test(button.textContent ?? '')
			)!
		);

		expect(api.deleteEntry).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
		// Saiu da lista: o botão vira "adicionar".
		expect(
			await screen.findByRole('button', { name: /Add to list|Adicionar à lista/ })
		).toBeInTheDocument();
	});

	it('trata 404 ao remover como já removido', async () => {
		const user = userEvent.setup();
		api.deleteEntry.mockRejectedValue(new ApiError(404, 'not_found', 'Entry not found.'));
		await openWithEntry();

		await user.click(screen.getByRole('button', { name: /Remove from list|Remover da lista/ }));
		const dialog = await screen.findByRole('alertdialog');
		await user.click(
			[...dialog.querySelectorAll('button')].find((button) =>
				/Remove from list|Remover da lista/.test(button.textContent ?? '')
			)!
		);

		expect(
			await screen.findByRole('button', { name: /Add to list|Adicionar à lista/ })
		).toBeInTheDocument();
	});

	it('salva status, progresso e nota', async () => {
		const user = userEvent.setup();
		await openWithEntry();
		api.updateEntry.mockResolvedValue({
			...makeEntry({ progress: 4 }),
			media: makeMedia(),
			pending: false
		});

		await user.click(screen.getByRole('button', { name: '+1' }));
		await user.click(screen.getByRole('button', { name: /^Save$|^Salvar$/ }));

		expect(api.updateEntry).toHaveBeenCalledWith(1, { status: 'CURRENT', progress: 4, score: 0 });
	});

	it('título longo fica cortado em 3 linhas e abre no toque', async () => {
		const long =
			'Tsuihou Sareta Cheat Fuyo Majutsushi wa Kimama na Second Life wo Ouka Suru'.repeat(2);
		api.media.mockResolvedValue({
			media: makeMedia({ titleUserPreferred: long }),
			entry: null,
			visits: []
		});
		render(MediaScreen, { props: { mediaId: 1 } });
		const title = await screen.findByRole('heading', { level: 1 });
		expect(title).toHaveClass('line-clamp-3', 'text-2xl');
		await userEvent.setup().click(title);
		expect(title).not.toHaveClass('line-clamp-3');
	});

	it('mostra ficha, onde assistir e relacionadas', async () => {
		api.media.mockResolvedValue({
			media: makeMedia({
				studios: ['Madhouse'],
				source: 'MANGA',
				startDate: '2023-09-29',
				externalLinks: [
					{
						site: 'Crunchyroll',
						url: 'https://www.crunchyroll.com/x',
						kind: 'STREAMING',
						language: null
					},
					{ site: 'Twitter', url: 'https://x.com/f', kind: 'SOCIAL', language: null }
				],
				relations: [
					{
						relationType: 'SOURCE',
						id: 300,
						mediaType: 'MANGA',
						format: 'MANGA',
						status: 'RELEASING',
						title: 'Frieren (mangá)',
						coverUrl: null
					}
				]
			}),
			entry: makeEntry({ progress: 3 }),
			visits: [
				{
					source: 'crunchyroll',
					url: 'https://www.crunchyroll.com/watch/ep7',
					progress: 7,
					createdAt: ''
				}
			]
		});
		render(MediaScreen, { props: { mediaId: 1 } });
		await screen.findByRole('heading', { level: 1 });

		const info = document.querySelector('[data-media-info]')!;
		expect(info).toHaveTextContent('Madhouse');
		expect(info).toHaveTextContent('Manga');
		expect(info).toHaveTextContent('2023');

		const watch = document.querySelector('[data-watch-links]')!;
		const hrefs = [...watch.querySelectorAll('a')].map((a) => a.getAttribute('href'));
		// A visita do Crunchyroll vale mais que o link oficial dele; Netflix entra como busca.
		expect(hrefs[0]).toBe('https://www.crunchyroll.com/watch/ep7');
		expect(hrefs).not.toContain('https://www.crunchyroll.com/x');
		expect(hrefs.some((href) => href?.startsWith('https://www.netflix.com/search'))).toBe(true);

		expect(document.querySelector('[data-relations]')).toHaveTextContent('Frieren (mangá)');
		expect(screen.getByRole('link', { name: /Twitter/ })).toHaveAttribute(
			'href',
			'https://x.com/f'
		);
	});

	it('sincronizar puxa de novo a obra e a entrada', async () => {
		await openWithEntry();
		api.syncEntry.mockResolvedValue({
			media: makeMedia(),
			entry: makeEntry({ progress: 9 }),
			visits: []
		});
		await userEvent.setup().click(document.querySelector('[data-sync-entry]') as HTMLElement);
		expect(api.syncEntry).toHaveBeenCalledWith(1);
		expect(await screen.findByText('9')).toBeInTheDocument();
	});
});
