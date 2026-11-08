import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomSite } from '$lib/api/types';

const request = vi.fn(async (..._args: unknown[]) => true);
const contains = vi.fn(async (..._args: unknown[]) => true);

vi.mock('wxt/browser', () => ({
	browser: {
		permissions: {
			request: (...args: unknown[]) => request(...(args as [])),
			contains: (...args: unknown[]) => contains(...(args as []))
		},
		runtime: { getURL: (path: string) => `chrome-extension://acerola${path}` }
	}
}));
vi.mock('wxt/utils/storage', () => ({
	storage: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) }
}));
vi.mock('$lib/messaging', () => ({ sendMessage: vi.fn(async () => undefined) }));
vi.mock('$lib/hooks/theme/use-theme.svelte', () => ({
	useTheme: () => ({ mode: 'dark', setMode: vi.fn() })
}));

const site: CustomSite = {
	id: '1',
	name: 'AnimeFire',
	mediaType: 'ANIME',
	matchPattern: 'https://animefire.one/*',
	urlPattern: '/(?<id>[\\w-]{11})/(?<progress>\\d+)',
	titleSelector: 'h1',
	enabled: true,
	searchUrl: 'https://animefire.one/pesquisar?q={title}'
};

const api = {
	customSites: vi.fn(),
	createCustomSite: vi.fn(),
	updateCustomSite: vi.fn(),
	deleteCustomSite: vi.fn()
};

vi.mock('$lib/state/app.svelte', () => ({
	app: {
		get api() {
			return api;
		},
		mode: 'popup',
		session: { user: { name: 'vinicius' } },
		handleError: vi.fn(),
		logout: vi.fn(),
		openFullPage: vi.fn()
	}
}));

import SettingsScreen from './SettingsScreen.svelte';

describe('SettingsScreen — sites personalizados', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		api.customSites.mockResolvedValue([site]);
		api.updateCustomSite.mockResolvedValue(site);
	});

	it('editar abre o formulário preenchido e salva no mesmo site', async () => {
		const user = userEvent.setup();
		render(SettingsScreen);

		await user.click(
			await screen.findByRole('button', { name: /Editar AnimeFire|Edit AnimeFire/ })
		);
		expect(
			await screen.findByRole('heading', { name: /Editar site|Edit site/ })
		).toBeInTheDocument();

		const search = screen.getByRole('textbox', { name: /Busca do site|Site search/ });
		expect(search).toHaveValue('https://animefire.one/pesquisar?q={title}');
		await user.clear(search);
		await user.type(search, 'https://animefire.one/animes/pesquisar?q={{title}');

		await user.click(screen.getByRole('button', { name: /Salvar site|Save site/ }));
		expect(api.updateCustomSite).toHaveBeenCalledWith(
			'1',
			expect.objectContaining({
				name: 'AnimeFire',
				titleSelector: 'h1',
				searchUrl: 'https://animefire.one/animes/pesquisar?q={title}'
			})
		);
		expect(api.createCustomSite).not.toHaveBeenCalled();
		// Ligado: confirma a permissão (já dada = o navegador responde sem perguntar).
		expect(request).toHaveBeenCalledWith({ origins: ['https://animefire.one/*'] });
	});

	it('trocar o domínio na edição pede a permissão do domínio novo', async () => {
		const user = userEvent.setup();
		render(SettingsScreen);
		await user.click(
			await screen.findByRole('button', { name: /Editar AnimeFire|Edit AnimeFire/ })
		);

		const match = await screen.findByDisplayValue('https://animefire.one/*');
		await user.clear(match);
		await user.type(match, 'https://animefire.plus/*');
		await user.click(screen.getByRole('button', { name: /Salvar site|Save site/ }));

		expect(request).toHaveBeenCalledOnce();
		expect(api.updateCustomSite).toHaveBeenCalledWith(
			'1',
			expect.objectContaining({ matchPattern: 'https://animefire.plus/*' })
		);
	});

	it('site ligado sem permissão mostra "Liberar", que pede a permissão', async () => {
		contains.mockResolvedValueOnce(false);
		const user = userEvent.setup();
		render(SettingsScreen);

		const grant = await screen.findByRole('button', { name: /Liberar|Allow/ });
		await user.click(grant);
		expect(request).toHaveBeenCalledWith({ origins: ['https://animefire.one/*'] });
	});
});
