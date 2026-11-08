import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '$lib/api/client';
import type { SyncRun } from '$lib/api/types';
import { makeLog } from '../../../tests/fixtures/media';
import { createSyncRunWatcher } from './sync-run.svelte';

function run(status: SyncRun['status']): SyncRun {
	return {
		id: 7,
		trigger: 'MANUAL',
		status,
		startedAt: '2026-11-07T12:00:00Z',
		finishedAt: null,
		entriesPulled: 0,
		entriesPushed: 0,
		entriesRemoved: 0,
		error: null,
		mode: 'INCREMENTAL',
		anilistRequests: 0
	};
}

describe('createSyncRunWatcher', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('dispara, junta os logs novos e para quando termina', async () => {
		const syncLogs = vi
			.fn()
			.mockResolvedValueOnce({ run: run('RUNNING'), logs: [makeLog(1, 'a')] })
			.mockResolvedValueOnce({ run: run('SUCCESS'), logs: [makeLog(2, 'b')] });
		const api = { sync: vi.fn().mockResolvedValue(run('RUNNING')), syncLogs } as unknown as Api;
		const onFinish = vi.fn();
		const watcher = createSyncRunWatcher(() => api, onFinish);

		await watcher.start(true);
		await vi.waitFor(() => expect(watcher.logs).toHaveLength(1));
		expect(api.sync).toHaveBeenCalledWith(true);
		expect(watcher.running).toBe(true);

		await vi.advanceTimersByTimeAsync(800);
		await vi.waitFor(() => expect(watcher.logs).toHaveLength(2));
		expect(syncLogs).toHaveBeenLastCalledWith(7, 1);
		expect(watcher.running).toBe(false);
		expect(onFinish).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(5000);
		expect(syncLogs).toHaveBeenCalledTimes(2);
	});

	it('guarda o erro quando o sync não começa', async () => {
		const failure = new Error('busy');
		const api = { sync: vi.fn().mockRejectedValue(failure) } as unknown as Api;
		const watcher = createSyncRunWatcher(() => api);

		await expect(watcher.start()).rejects.toBe(failure);
		expect(watcher.error).toBe(failure);
	});

	it('para de buscar ao trocar de sync', async () => {
		const syncLogs = vi.fn().mockResolvedValue({ run: run('RUNNING'), logs: [] });
		const api = { syncLogs } as unknown as Api;
		const watcher = createSyncRunWatcher(() => api);

		watcher.watch(run('RUNNING'));
		watcher.stop();
		await vi.advanceTimersByTimeAsync(3000);
		expect(syncLogs).toHaveBeenCalledTimes(1);
	});
});
