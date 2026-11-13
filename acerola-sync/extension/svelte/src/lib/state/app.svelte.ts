import { ApiError, createApi, type Api } from '$lib/api/client';
import type { CustomSite, Resolved } from '$lib/api/types';
import type { CurrentPage } from '$lib/tracking/types';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import type { LinkRequest } from '$lib/messaging';
import { m } from '$lib/paraglide/messages';
import {
	getServerUrl,
	getSession,
	saveSession,
	type StoredSession
} from '$lib/services/session.service';
import { toast } from 'svelte-sonner';
import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

export type TopRoute = 'list' | 'search' | 'activity' | 'settings';

export type Route =
	{ name: TopRoute } | { name: 'media'; mediaId: number } | { name: 'link'; request: LinkRequest };

/** `popup`: janelinha do ícone. `page`: a mesma interface numa aba inteira (`app.html`). */
export type AppMode = 'popup' | 'page';

const TOP_ROUTES: TopRoute[] = ['list', 'search', 'activity', 'settings'];

export function isTopRoute(value: unknown): value is TopRoute {
	return TOP_ROUTES.includes(value as TopRoute);
}

/** Obra da aba onde o popup foi aberto (se for um site rastreado). */
export type HerePage = {
	page: CurrentPage;
	resolved: Resolved | null;
};

let mode = $state<AppMode>('popup');
let here = $state<HerePage | null>(null);
let ready = $state(false);
let serverUrl = $state('');
let session = $state<StoredSession | null>(null);
let route = $state<Route>({ name: 'list' });
const stack: Route[] = [];

const api = $derived<Api | null>(serverUrl && session ? createApi(serverUrl, session.token) : null);

/** Copia os sites personalizados para o storage, de onde o background registra os scripts. */
async function refreshCustomSites(client: Api) {
	try {
		const sites = await client.customSites();
		await storage.setItem<CustomSite[]>(STORAGE_KEYS.customSites, sites);
	} catch (error) {
		console.warn('[App] Could not refresh custom sites', error);
	}
}

/** Pergunta ao content script da aba ativa o que está aberto e acha a obra no espelho. */
async function detectHere(client: Api) {
	try {
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
		if (!tab?.id) return;
		const page = (await browser.tabs.sendMessage(tab.id, { type: 'page:current' })) as
			CurrentPage | null | undefined;
		if (!page) return;
		const resolved = await client.resolve({
			site: page.site,
			identifier: page.identifier,
			title: page.title,
			mediaType: page.mediaType,
			anilistId: page.anilistId
		});
		here = { page, resolved };
	} catch {
		// Aba sem content script (site não rastreado, chrome://…): não há obra para mostrar.
	}
}

export const PENDING_MEDIA_TTL_MS = 30_000;

/** Obra que o aviso do site pediu para abrir no popup. Consome o pedido (vale uma vez). */
async function takePendingMedia(): Promise<number | null> {
	try {
		const pending = await storage.getItem<{ mediaId: number; at: number }>(
			STORAGE_KEYS.pendingMedia
		);
		if (!pending) return null;
		await storage.removeItem(STORAGE_KEYS.pendingMedia);
		return Date.now() - pending.at < PENDING_MEDIA_TTL_MS ? pending.mediaId : null;
	} catch {
		return null;
	}
}

function linkFromUrl(): LinkRequest | null {
	const raw = new URLSearchParams(location.search).get('link');
	if (!raw) return null;
	try {
		return JSON.parse(raw) as LinkRequest;
	} catch {
		return null;
	}
}

export const app = {
	get ready() {
		return ready;
	},
	get mode() {
		return mode;
	},
	/** Última aba do menu aberta — no modo página, a obra abre por cima dela. */
	get topRoute(): TopRoute {
		for (let index = stack.length - 1; index >= 0; index--) {
			const name = stack[index].name;
			if (isTopRoute(name)) return name;
		}
		return isTopRoute(route.name) ? route.name : 'list';
	},
	get serverUrl() {
		return serverUrl;
	},
	get session() {
		return session;
	},
	get api() {
		return api;
	},
	get route() {
		return route;
	},
	get here() {
		return here;
	},
	get canGoBack() {
		return stack.length > 0;
	},

	async init(appMode: AppMode = 'popup') {
		mode = appMode;
		const [savedUrl, savedSession, lastPage] = await Promise.all([
			getServerUrl(),
			getSession(),
			storage.getItem<TopRoute>(STORAGE_KEYS.lastPage)
		]);
		serverUrl = savedUrl ?? '';
		session = savedSession;

		const link = linkFromUrl();
		const fromUrl = Number(new URLSearchParams(location.search).get('media'));
		const mediaId = fromUrl > 0 ? fromUrl : mode === 'popup' ? await takePendingMedia() : null;
		const params = new URLSearchParams(location.search);
		if (link) route = { name: 'link', request: link };
		else if (params.has('site')) route = { name: 'settings' };
		else if (mediaId && Number.isInteger(mediaId)) route = { name: 'media', mediaId };
		else if (isTopRoute(lastPage)) route = { name: lastPage };

		ready = true;
		// O background confere episódio novo quando o popup fecha (o progresso pode ter mudado).
		if (mode === 'popup') {
			try {
				browser.runtime.connect({ name: 'popup' });
			} catch {
				// Fora da extensão (testes, Storybook): sem background para avisar.
			}
		}
		if (api) {
			void refreshCustomSites(api);
			if (mode === 'popup') void detectHere(api);
		}
	},

	/** Troca de aba do menu lateral: zera o histórico de "voltar". */
	open(name: TopRoute) {
		stack.length = 0;
		route = { name };
		void storage.setItem(STORAGE_KEYS.lastPage, name);
	},

	push(next: Route) {
		stack.push(route);
		route = next;
	},

	back() {
		route = stack.pop() ?? { name: 'list' };
	},

	/** Abre a interface numa aba inteira e fecha o popup. `search` vai junto (ex.: `?site=new`). */
	async openFullPage(search = '') {
		await browser.tabs.create({ url: browser.runtime.getURL(`/app.html${search}`) });
		if (mode === 'popup') window.close();
	},

	async login(url: string, next: StoredSession) {
		serverUrl = url;
		session = next;
		await Promise.all([storage.setItem(STORAGE_KEYS.serverUrl, url), saveSession(next)]);
		if (api) void refreshCustomSites(api);
		this.open('list');
	},

	async logout() {
		try {
			await api?.logout();
		} catch {
			// Sessão já inválida no server: limpa do mesmo jeito.
		}
		session = null;
		await saveSession(null);
	},

	refreshCustomSites() {
		return api ? refreshCustomSites(api) : Promise.resolve();
	},

	/**
	 * Mostra o erro da API num toast. Sessão inválida desloga, e a tela volta para o login.
	 */
	async handleError(error: unknown) {
		if (error instanceof ApiError && error.isUnauthorized) {
			session = null;
			await saveSession(null);
			toast.error(m['sync.errors.session_expired']());
			return;
		}
		if (error instanceof ApiError && error.status === 0) {
			toast.error(m['sync.errors.server_offline']());
			return;
		}
		toast.error(error instanceof Error ? error.message : String(error));
	}
};
