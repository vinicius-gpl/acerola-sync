import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '$lib/services/airing.service';

let saved: NotificationItem[] | null = null;
const setItem = vi.fn(async (_key: string, value: NotificationItem[]) => {
	saved = value;
});
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn(async () => saved),
		setItem: (key: string, value: NotificationItem[]) => setItem(key, value)
	}
}));
const push = vi.fn();
vi.mock('$lib/state/app.svelte', () => ({
	app: { mode: 'popup', push: (...args: unknown[]) => push(...args), back: vi.fn() }
}));

import NotificationsScreen from './NotificationsScreen.svelte';

function item(mediaId: number, episode: number, read: boolean): NotificationItem {
	return {
		id: `airing:${mediaId}:${episode}`,
		mediaId,
		title: `Obra ${mediaId}`,
		episode,
		cover: null,
		at: '2026-11-13T12:00:00Z',
		read
	};
}

describe('NotificationsScreen', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		saved = null;
	});

	it('sem aviso mostra o vazio', async () => {
		render(NotificationsScreen);
		expect(await screen.findByText('Nenhum aviso ainda')).toBeInTheDocument();
	});

	it('lista os últimos, marca o novo e salva tudo como lido', async () => {
		saved = [item(2, 7, false), item(1, 4, true)];
		render(NotificationsScreen);

		expect(await screen.findByText('Obra 2')).toBeInTheDocument();
		expect(screen.getByText('Obra 1')).toBeInTheDocument();
		expect(screen.getAllByText('Novo')).toHaveLength(1);
		expect(setItem).toHaveBeenCalledWith(
			'local:notifications',
			expect.arrayContaining([expect.objectContaining({ id: 'airing:2:7', read: true })])
		);
	});

	it('abre a obra e limpa a lista', async () => {
		saved = [item(2, 7, true)];
		render(NotificationsScreen);

		await userEvent.click(await screen.findByText('Obra 2'));
		expect(push).toHaveBeenCalledWith({ name: 'media', mediaId: 2 });

		await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
		expect(saved).toEqual([]);
		expect(await screen.findByText('Nenhum aviso ainda')).toBeInTheDocument();
	});
});
