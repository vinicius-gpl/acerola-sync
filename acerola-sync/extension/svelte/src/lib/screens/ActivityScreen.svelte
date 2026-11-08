<script lang="ts">
	import AcerolaTimePicker from '$lib/components/acerola-time-picker/acerola-time-picker.svelte';
	import type { HistoryItem, SyncRun, SyncStatus } from '$lib/api/types';
	import AcerolaChipTabs from '$lib/components/acerola-chip-tabs/acerola-chip-tabs.svelte';
	import AcerolaEmptyState from '$lib/components/acerola-empty-state/acerola-empty-state.svelte';
	import AcerolaLogConsole from '$lib/components/acerola-log-console/acerola-log-console.svelte';
	import AcerolaSection from '$lib/components/acerola-section/acerola-section.svelte';
	import AcerolaStatTile from '$lib/components/acerola-stat-tile/acerola-stat-tile.svelte';
	import AcerolaSwitch from '$lib/components/acerola-switch/acerola-switch.svelte';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { createSyncRunWatcher } from '$lib/state/sync-run.svelte';
	import { relativeAge } from '$lib/utils/greeting.utils';
	import { revealIn, spinWhile, staggerIn } from '$lib/utils/motion.utils';
	import { formatDateTime, saoPauloToUtc, shortUtc, utcToSaoPaulo } from '$lib/utils/time.utils';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let tab = $state<'sync' | 'history'>('sync');
	let status = $state<SyncStatus | null>(null);
	let history = $state<HistoryItem[]>([]);
	let scheduleEnabled = $state(false);
	/** Horários em Brasília, como o usuário digita. O server recebe em UTC. */
	let scheduleTimes = $state<string[]>([]);
	let newTime = $state('09:00');
	let fullEvery = $state(24);

	const FULL_INTERVALS = [
		{ id: '0', label: m['sync.activity.full_manual'] },
		{ id: '6', label: m['sync.activity.full_6h'] },
		{ id: '24', label: m['sync.activity.full_daily'] },
		{ id: '72', label: m['sync.activity.full_3d'] },
		{ id: '168', label: m['sync.activity.full_weekly'] }
	];

	async function saveFullInterval(id: string) {
		const previous = fullEvery;
		fullEvery = Number(id);
		try {
			await app.api?.saveFullSyncInterval(fullEvery);
			toast.success(m['sync.activity.full_saved']());
		} catch (error) {
			fullEvery = previous;
			await app.handleError(error);
		}
	}

	const watcher = createSyncRunWatcher(
		() => app.api,
		() => void loadStatus()
	);
	const page = $derived(app.mode === 'page');
	const current = $derived(watcher.run ?? status?.runs[0] ?? null);
	const running = $derived(watcher.running || !!status?.running);

	async function loadStatus() {
		try {
			status = (await app.api?.syncStatus()) ?? null;
			if (!status) return;
			scheduleEnabled = status.settings.scheduleEnabled;
			fullEvery = status.settings.fullSyncEveryHours ?? 24;
			scheduleTimes = status.settings.scheduleTimes
				.map((time) => utcToSaoPaulo(time))
				.filter((time): time is string => !!time);
			// Abre os logs do último sync (e acompanha, se ainda estiver rodando).
			if (!watcher.run && status.runs[0]) watcher.watch(status.runs[0]);
		} catch (error) {
			await app.handleError(error);
		}
	}

	async function loadHistory() {
		try {
			history = (await app.api?.history(100)) ?? [];
		} catch (error) {
			await app.handleError(error);
		}
	}

	async function startSync(full: boolean) {
		try {
			await watcher.start(full);
		} catch (error) {
			await app.handleError(error);
		}
	}

	function addTime() {
		if (!saoPauloToUtc(newTime)) {
			toast.error(m['sync.activity.invalid_time']());
			return;
		}
		if (!scheduleTimes.includes(newTime)) scheduleTimes = [...scheduleTimes, newTime].sort();
	}

	async function saveSchedule() {
		if (!app.api) return;
		try {
			const utc = scheduleTimes.map((time) => saoPauloToUtc(time)).filter((t): t is string => !!t);
			await app.api.saveSchedule(scheduleEnabled, utc);
			toast.success(m['sync.activity.schedule_saved']());
		} catch (error) {
			await app.handleError(error);
		}
	}

	function runLabel(run: SyncRun) {
		return run.mode === 'FULL'
			? m['sync.activity.mode_full']()
			: m['sync.activity.mode_incremental']();
	}

	function sourceLabel(source: string) {
		if (source === 'MANUAL') return m['sync.activity.source_manual']();
		if (source.startsWith('custom:')) return m['sync.activity.source_custom']();
		return source;
	}

	onMount(() => {
		void loadStatus();
		void loadHistory();
	});
	onDestroy(() => watcher.stop());
</script>

<div class="flex flex-col gap-5 pb-4">
	<header>
		<p class="text-xs font-semibold text-muted-foreground">{m['sync.activity.eyebrow']()}</p>
		<h1 class="leading-none font-black tracking-tighter {page ? 'text-6xl' : 'text-[44px]'}">
			{m['sync.activity.title']()}
		</h1>
	</header>

	<AcerolaChipTabs
		data={{
			items: [
				{ id: 'sync', label: m['sync.activity.tab_sync']() },
				{ id: 'history', label: m['sync.activity.tab_history'](), count: history.length || null }
			],
			active: tab
		}}
		events={{ onSelect: (id) => (tab = id as 'sync' | 'history') }}
	/>

	{#if tab === 'sync'}
		<!-- Cartão de estado: grande, colorido pelo resultado, com o botão de sync. -->
		<section
			use:revealIn
			class="flex flex-col gap-4 rounded-card p-5 {running
				? 'bg-primary-soft text-primary'
				: current?.status === 'FAILED'
					? 'bg-destructive-soft text-destructive'
					: 'bg-success-soft text-success'}"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-[11px] font-bold tracking-widest uppercase opacity-80">
						{current ? runLabel(current) : m['sync.activity.never']()}
					</p>
					<p class="mt-1 text-3xl leading-none font-black tracking-tight">
						{running
							? m['sync.activity.running']()
							: current?.status === 'FAILED'
								? m['sync.activity.failed']()
								: m['sync.activity.up_to_date']()}
					</p>
					{#if current && !running}
						<p class="mt-2 text-xs font-semibold opacity-80">
							{m['sync.activity.ago']({
								age: relativeAge(current.finishedAt ?? current.startedAt) ?? ''
							})}
							· {formatDateTime(current.startedAt)}
						</p>
					{/if}
				</div>
				<span
					use:spinWhile={running}
					class="flex size-12 flex-none items-center justify-center rounded-full bg-background/40"
				>
					<RefreshCwIcon size={22} />
				</span>
			</div>

			{#if current && !running}
				<div class="flex flex-wrap gap-1.5 text-[11px] font-bold">
					<span class="rounded-full bg-background/40 px-2.5 py-1">
						{m['sync.activity.pulled']({ count: current.entriesPulled })}
					</span>
					<span class="rounded-full bg-background/40 px-2.5 py-1">
						{m['sync.activity.pushed']({ count: current.entriesPushed })}
					</span>
					<span class="rounded-full bg-background/40 px-2.5 py-1">
						{m['sync.activity.requests']({ count: current.anilistRequests })}
					</span>
				</div>
			{/if}

			<div class="flex gap-2">
				<button
					type="button"
					class="h-11 flex-1 cursor-pointer rounded-full bg-foreground text-sm font-black text-background transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
					disabled={running}
					onclick={() => startSync(false)}
				>
					{m['sync.activity.sync_now']()}
				</button>
				<button
					type="button"
					class="h-11 cursor-pointer rounded-full bg-background/40 px-4 text-xs font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
					disabled={running}
					onclick={() => startSync(true)}
					title={m['sync.activity.full_hint']()}
				>
					{m['sync.activity.full']()}
				</button>
			</div>
		</section>

		<AcerolaSection
			data={{ title: m['sync.activity.logs'](), hint: m['sync.activity.logs_hint']() }}
		>
			<AcerolaLogConsole
				data={{ logs: watcher.logs, running: watcher.running, empty: m['sync.activity.no_logs']() }}
			/>
		</AcerolaSection>

		{#if status?.pendingEntries}
			<AcerolaStatTile
				data={{
					label: m['sync.activity.pending'](),
					value: status.pendingEntries,
					hint: m['sync.activity.pending_hint']()
				}}
				ui={{ tone: 'warning' }}
			/>
		{/if}

		<AcerolaSection
			data={{ title: m['sync.activity.schedule'](), hint: m['sync.activity.schedule_hint']() }}
		>
			{#snippet actions()}
				<AcerolaSwitch
					state={{ checked: scheduleEnabled }}
					events={{ onCheckedChange: (checked) => (scheduleEnabled = checked) }}
				/>
			{/snippet}
			<div class="flex flex-col gap-3 rounded-card bg-card p-4">
				<div class="flex flex-wrap gap-2" use:staggerIn={{ key: scheduleTimes.length }}>
					{#each scheduleTimes as time (time)}
						<span class="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-3.5">
							<span class="text-lg leading-none font-black tabular-nums">{time}</span>
							<span class="text-[10px] font-bold text-muted-foreground">
								{shortUtc(saoPauloToUtc(time) ?? '')} UTC
							</span>
							<button
								type="button"
								class="flex size-6 cursor-pointer items-center justify-center rounded-full bg-background text-muted-foreground hover:text-destructive"
								aria-label={m['sync.common.remove']()}
								onclick={() => (scheduleTimes = scheduleTimes.filter((item) => item !== time))}
							>
								<XIcon size={12} />
							</button>
						</span>
					{:else}
						<span class="text-xs text-muted-foreground">{m['sync.activity.no_times']()}</span>
					{/each}
				</div>
				<div class="flex items-center gap-2">
					<AcerolaTimePicker
						data={{ value: newTime, label: m['sync.activity.new_time']() }}
						events={{ onChange: (value) => (newTime = value) }}
					/>
					<button
						type="button"
						class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface"
						aria-label={m['sync.activity.add_time']()}
						onclick={addTime}
					>
						<PlusIcon size={16} />
					</button>
					<button
						type="button"
						class="ml-auto h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-black text-primary-foreground"
						onclick={saveSchedule}
					>
						{m['sync.common.save']()}
					</button>
				</div>
			</div>
		</AcerolaSection>

		<AcerolaSection
			data={{
				title: m['sync.activity.full_interval'](),
				hint: m['sync.activity.full_interval_hint']()
			}}
		>
			<AcerolaChipTabs
				data={{
					items: FULL_INTERVALS.map((item) => ({ id: item.id, label: item.label() })),
					active: String(fullEvery)
				}}
				events={{ onSelect: saveFullInterval }}
				ui={{ size: 'sm', label: m['sync.activity.full_interval']() }}
			/>
		</AcerolaSection>

		{#if status && status.runs.length > 1}
			<AcerolaSection data={{ title: m['sync.activity.previous']() }}>
				<ul class="flex flex-col gap-1.5" use:staggerIn>
					{#each status.runs as run (run.id)}
						<li>
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-3 rounded-inner px-3 py-2.5 text-left transition-colors hover:bg-surface {watcher
									.run?.id === run.id
									? 'bg-surface'
									: ''}"
								onclick={() => watcher.watch(run)}
							>
								<span
									class="size-2.5 flex-none rounded-full {run.status === 'FAILED'
										? 'bg-destructive'
										: run.status === 'RUNNING'
											? 'bg-primary'
											: 'bg-success'}"
								></span>
								<span class="flex-1 text-sm font-bold">{runLabel(run)}</span>
								<span class="text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</AcerolaSection>
		{/if}
	{:else if history.length === 0}
		<AcerolaEmptyState
			data={{
				title: m['sync.activity.history_empty'](),
				hint: m['sync.activity.history_hint'](),
				icon: HistoryIcon
			}}
		/>
	{:else}
		<ol class="flex flex-col gap-1" use:staggerIn>
			{#each history as item (item.id)}
				<li>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 rounded-tile p-2 text-left transition-colors hover:bg-surface"
						onclick={() => app.push({ name: 'media', mediaId: item.mediaId })}
					>
						<img
							src={item.coverUrl ?? ''}
							alt=""
							class="h-20 w-14 flex-none rounded-inner bg-surface object-cover shadow-lift"
						/>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-2 text-sm leading-tight font-bold">{item.title}</p>
							<p class="text-xs text-muted-foreground">
								{sourceLabel(item.source)} · {formatDateTime(item.createdAt)}
							</p>
						</div>
						<span
							class="flex-none rounded-full bg-surface px-2.5 py-1 text-xs font-black tabular-nums"
						>
							{item.previous} → {item.progress}
						</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</div>
