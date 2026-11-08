<script lang="ts">
	import { createApi, normalizeServerUrl } from '$lib/api/client';
	import AcerolaLogo from '$lib/assets/icons/acerola.svg?component';
	import { m } from '$lib/paraglide/messages';
	import { getRedirectUrl, requestAnilistToken } from '$lib/services/anilist-auth.service';
	import { app } from '$lib/state/app.svelte';
	import { revealIn } from '$lib/utils/motion.utils';
	import { STORAGE_KEYS } from '$lib/constants/storage-keys';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { storage } from 'wxt/utils/storage';

	let serverUrl = $state(app.serverUrl);
	let busy = $state(false);
	const redirectUrl = getRedirectUrl();
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	// O endereço é salvo enquanto você digita (com uma pausa de 400 ms): clicar fora fecha o
	// popup, e ele não pode voltar vazio.
	function rememberServer() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			void storage.setItem(STORAGE_KEYS.serverUrl, normalizeServerUrl(serverUrl));
		}, 400);
	}
	onDestroy(() => clearTimeout(saveTimer));

	function deviceName() {
		const agent = navigator.userAgent;
		if (agent.includes('Firefox')) return 'Firefox';
		if (agent.includes('Edg/')) return 'Edge';
		return 'Chrome';
	}

	async function testServer() {
		try {
			const health = await createApi(normalizeServerUrl(serverUrl)).health();
			toast.success(m['sync.login.server_ok']({ version: health.version }));
		} catch {
			toast.error(m['sync.errors.server_offline']());
		}
	}

	async function login() {
		const url = normalizeServerUrl(serverUrl);
		if (!url) {
			toast.error(m['sync.login.missing_fields']());
			return;
		}

		busy = true;
		try {
			// O Client ID mora no `.env` do server; a extensão não guarda configuração do AniList.
			const api = createApi(url);
			const { anilistClientId } = await api.authConfig();
			const token = await requestAnilistToken(anilistClientId);
			if (!token) {
				toast.error(m['sync.login.cancelled']());
				return;
			}
			const result = await api.login(token, deviceName());
			await app.login(url, { token: result.sessionToken, user: result.user });
			toast.success(m['sync.login.welcome']({ name: result.user.name }));
		} catch (error) {
			await app.handleError(error);
		} finally {
			busy = false;
		}
	}

	async function copyRedirect() {
		await navigator.clipboard.writeText(redirectUrl);
		toast.success(m['sync.common.copied']());
	}
</script>

<div class="flex min-h-full flex-col justify-center gap-6 py-4">
	<div use:revealIn class="flex flex-col items-start gap-3">
		<AcerolaLogo class="size-16" />
		<h1 class="text-[52px] leading-[0.9] font-black tracking-tighter">
			Acerola<br /><span class="text-primary">Sync</span>
		</h1>
		<p class="max-w-72 text-sm text-muted-foreground">{m['sync.login.subtitle']()}</p>
	</div>

	<div use:revealIn={{ delay: 0.08 }} class="flex flex-col gap-3">
		<label class="flex h-14 items-center gap-2 rounded-full bg-card pr-2 pl-5">
			<input
				type="url"
				class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
				spellcheck="false"
				oninput={rememberServer}
				placeholder="https://sync.acerola.app"
				aria-label={m['sync.login.server_url']()}
				bind:value={serverUrl}
			/>
			<button
				type="button"
				class="h-10 cursor-pointer rounded-full bg-surface px-4 text-xs font-bold"
				onclick={testServer}
			>
				{m['sync.login.test']()}
			</button>
		</label>

		<button
			type="button"
			class="h-14 cursor-pointer rounded-full bg-primary font-black text-base text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
			disabled={busy}
			onclick={login}
		>
			{busy ? m['sync.common.loading']() : m['sync.login.button']()}
		</button>
	</div>

	<div
		use:revealIn={{ delay: 0.16 }}
		class="rounded-tile bg-card p-4 text-xs text-muted-foreground"
	>
		<p>{m['sync.login.redirect_hint']()}</p>
		<button
			type="button"
			class="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-full bg-surface px-4 py-2 text-left font-mono text-foreground"
			onclick={copyRedirect}
		>
			<span class="min-w-0 flex-1 truncate">{redirectUrl}</span>
			<CopyIcon size={14} />
		</button>
	</div>
</div>
