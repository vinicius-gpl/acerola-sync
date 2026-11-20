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
import { screenError, type ScreenError } from '$lib/utils/error-screen.utils';
import { toast } from 'svelte-sonner';
import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

export type TopRoute = 'list' | 'search' | 'activity' | 'settings';

export type Route =
	| { name: TopRoute }
	| { name: 'media'; mediaId: number }
	| { name: 'link'; request: LinkRequest }
	| { name: 'notifications' };

/** `popup`: the icon's small window. `page`: the same interface in a full tab (`app.html`). */
export type AppMode = 'popup' | 'page';

const TOP_ROUTES: TopRoute[] = ['list', 'search', 'activity', 'settings'];

export function isTopRoute(value: unknown): value is TopRoute {
	return TOP_ROUTES.includes(value as TopRoute);
}

/** Media of the tab where the popup was opened (if it is a tracked site). */
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
/** Main load of the current screen failed: the shell shows the error screen instead of it. */
let failure = $state<ScreenError | null>(null);
/** Bumped by "Try again" so the screen mounts again and redoes its load. */
let attempt = $state(0);
const stack: Route[] = [];

const api = $derived<Api | null>(serverUrl && session ? createApi(serverUrl, session.token) : null);

/** Copies the custom sites to storage, where the background registers the scripts from. */
async function refreshCustomSites(client: Api) {
	try {
		const sites = await client.customSites();
		await storage.setItem<CustomSite[]>(STORAGE_KEYS.customSites, sites);
	} catch (error) {
		console.warn('[App] Could not refresh custom sites', error);
	}
}

/** Asks the active tab's content script what is open and finds the media in the mirror. */
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
		// Tab without a content script (untracked site, chrome://…): no media to show.
	}
}

export const PENDING_MEDIA_TTL_MS = 30_000;

/** Media the on-site notice asked to open in the popup. Consumes the request (valid once). */
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
	/** Last menu tab opened: in page mode, the media opens over it. */
	get topRoute(): TopRoute {
		for (let index = stack.length - 1; index >= 0; index--) {
			const name = stack[index].name;
			if (isTopRoute(name)) return name;
		}
		return isTopRoute(route.name) ? route.name : 'list';
	},
	/** Screen under the media in page mode: the last one that is not a media (menu tab or notices). */
	get underRoute(): TopRoute | 'notifications' {
		for (let index = stack.length - 1; index >= 0; index--) {
			const name = stack[index].name;
			if (isTopRoute(name) || name === 'notifications') return name;
		}
		return this.topRoute;
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
	get failure() {
		return failure;
	},
	get attempt() {
		return attempt;
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
		// The background checks for new episodes when the popup closes (the progress may have changed).
		if (mode === 'popup') {
			try {
				browser.runtime.connect({ name: 'popup' });
			} catch {
				// Outside the extension (tests, Storybook): no background to notify.
			}
		}
		if (api) {
			void refreshCustomSites(api);
			if (mode === 'popup') void detectHere(api);
		}
	},

	/** Switching side menu tabs: clears the "back" history. */
	open(name: TopRoute) {
		failure = null;
		stack.length = 0;
		route = { name };
		void storage.setItem(STORAGE_KEYS.lastPage, name);
	},

	push(next: Route) {
		failure = null;
		stack.push(route);
		route = next;
	},

	back() {
		failure = null;
		route = stack.pop() ?? { name: 'list' };
	},

	/** Opens the interface in a full tab and closes the popup. `search` goes along (e.g. `?site=new`). */
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
			// Session already invalid on the server: clear it the same way.
		}
		session = null;
		await saveSession(null);
	},

	refreshCustomSites() {
		return api ? refreshCustomSites(api) : Promise.resolve();
	},

	/**
	 * The screen could not load what it shows: swaps it for the error screen. An invalid session
	 * still logs out, like `handleError`.
	 */
	async failScreen(error: unknown) {
		if (error instanceof ApiError && error.isUnauthorized) return this.handleError(error);
		console.warn('[App] Screen load failed', error);
		// The error screen already says it: no toast repeating it on top.
		toast.dismiss();
		failure = screenError(error, typeof navigator === 'undefined' ? true : navigator.onLine);
	},

	/** "Try again" on the error screen: mounts the screen again. */
	retryScreen() {
		failure = null;
		attempt++;
	},

	/**
	 * Shows the API error in a toast. An invalid session logs out and the screen goes back to login.
	 */
	async handleError(error: unknown) {
		// The error screen is up: side loads (counts, facets) failing too need no toast.
		if (failure && !(error instanceof ApiError && error.isUnauthorized)) return;
		if (error instanceof ApiError && error.isUnauthorized) {
			session = null;
			await saveSession(null);
			toast.error(m['sync.errors.sessionExpired']());
			return;
		}
		if (error instanceof ApiError && error.status === 0) {
			toast.error(m['sync.errors.serverOffline']());
			return;
		}
		toast.error(error instanceof Error ? error.message : String(error));
	}
};
