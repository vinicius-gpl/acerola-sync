import type { Api } from '$lib/api/client';
import type { SyncLog, SyncRun } from '$lib/api/types';

const POLL_MS = 800;

/**
 * Acompanha um sync: dispara (`start`) ou abre um que já existe (`watch`) e busca só as linhas
 * novas de log a cada 800 ms até ele sair de `RUNNING`.
 */
export function createSyncRunWatcher(getApi: () => Api | null, onFinish?: (run: SyncRun) => void) {
	let run = $state<SyncRun | null>(null);
	let logs = $state<SyncLog[]>([]);
	let error = $state<unknown>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let generation = 0;

	async function poll(id: number, mine: number) {
		const api = getApi();
		if (!api || mine !== generation) return;
		try {
			const after = logs.at(-1)?.id ?? 0;
			const result = await api.syncLogs(id, after);
			if (mine !== generation) return;
			run = result.run;
			if (result.logs.length) logs = [...logs, ...result.logs];
			if (result.run.status === 'RUNNING') {
				timer = setTimeout(() => void poll(id, mine), POLL_MS);
			} else {
				onFinish?.(result.run);
			}
		} catch (failure) {
			error = failure;
		}
	}

	function watch(target: SyncRun) {
		stop();
		const mine = ++generation;
		run = target;
		logs = [];
		error = null;
		void poll(target.id, mine);
	}

	async function start(full = false) {
		const api = getApi();
		if (!api) return;
		error = null;
		try {
			watch(await api.sync(full));
		} catch (failure) {
			error = failure;
			throw failure;
		}
	}

	function stop() {
		generation++;
		clearTimeout(timer);
	}

	return {
		get run() {
			return run;
		},
		get logs() {
			return logs;
		},
		get error() {
			return error;
		},
		get running() {
			return run?.status === 'RUNNING';
		},
		start,
		watch,
		stop
	};
}
