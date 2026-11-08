import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncRun } from '$lib/api/types';
import { makeLog } from '../../../tests/fixtures/media';

function run(status: SyncRun['status'], id = 3): SyncRun {
	return {
		id,
		trigger: 'MANUAL',
		status,
		mode: 'INCREMENTAL',
		startedAt: '2026-11-07T12:00:00Z',
		finishedAt: null,
		entriesPulled: 2,
		entriesPushed: 0,
		entriesRemoved: 0,
		anilistRequests: 1,
		error: null
	};
}

const api = {
	syncStatus: vi.fn(),
	history: vi.fn(),
	sync: vi.fn(),
	syncLogs: vi.fn(),
	saveSchedule: vi.fn(),
	saveFullSyncInterval: vi.fn()
};

vi.mock('$lib/state/app.svelte', () => ({
	app: {
		get api() {
			return api;
		},
		mode: 'popup',
		push: vi.fn(),
		handleError: vi.fn()
	}
}));

import ActivityScreen from './ActivityScreen.svelte';

describe('ActivityScreen', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		api.syncStatus.mockResolvedValue({
			settings: { scheduleEnabled: true, scheduleTimes: ['12:00:00'], fullSyncEveryHours: 24 },
			runs: [],
			running: false,
			pendingEntries: 0
		});
		api.history.mockResolvedValue([]);
	});

	it('mostra a agenda no horário de Brasília', async () => {
		render(ActivityScreen);
		// 12:00 UTC = 09:00 em Brasília.
		expect(await screen.findByText('09:00')).toBeInTheDocument();
		expect(screen.getByText('12:00 UTC')).toBeInTheDocument();
	});

	it('dispara o sync e mostra os logs', async () => {
		const user = userEvent.setup();
		api.sync.mockResolvedValue(run('RUNNING'));
		api.syncLogs.mockResolvedValue({
			run: run('SUCCESS'),
			logs: [makeLog(1, 'Page 1: 2 changed')]
		});
		render(ActivityScreen);

		await user.click(await screen.findByRole('button', { name: /Sync now|Sincronizar agora/ }));
		expect(api.sync).toHaveBeenCalledWith(false);
		expect(await screen.findByText('Page 1: 2 changed')).toBeInTheDocument();
	});

	it('salva a agenda convertida para UTC', async () => {
		const user = userEvent.setup();
		render(ActivityScreen);
		await screen.findByText('09:00');

		await user.click(screen.getByRole('button', { name: /^Save$|^Salvar$/ }));
		expect(api.saveSchedule).toHaveBeenCalledWith(true, ['12:00:00']);
	});

	it('lista inteira automática: mostra o intervalo salvo e troca na hora', async () => {
		api.saveFullSyncInterval.mockResolvedValue({});
		render(ActivityScreen);
		const tabs = await screen.findByRole('tablist', {
			name: /Lista inteira automática|Automatic full list/
		});
		expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(/Diária|Daily/);

		await userEvent.setup().click(within(tabs).getByRole('tab', { name: /Semanal|Weekly/ }));
		expect(api.saveFullSyncInterval).toHaveBeenCalledWith(168);
		expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(/Semanal|Weekly/);
	});
});
