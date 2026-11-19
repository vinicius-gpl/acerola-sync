import type { Resolved } from '$lib/api/types';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { sendMessage } from '$lib/messaging';
import { m } from '$lib/paraglide/messages';
import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { dismissToast, setFab, showToast, type ToastOptions } from './toast';
import type { CurrentPage, DetectedPage, SiteAdapter } from './types';

const URL_POLL_MS = 1000;
const DETECT_RETRY_MS = 1500;
const DETECT_MAX_TRIES = 20;
const VIDEO_THRESHOLD = 0.85;
const DEFAULT_MANGA_DELAY_SECONDS = 10;
const DETECTED_TOAST_MS = 6000;
const OVERVIEW_TOAST_MS = 6750;
const HERE_TOAST_ID = 'acerola-here';
const FAB_ICON = browser.runtime.getURL('/icon/96.png');

type Cancel = () => void;

function unitLabel(page: DetectedPage): string {
	return page.mediaType === 'ANIME'
		? m['sync.tracking.episode']({ number: page.progress })
		: m['sync.tracking.chapter']({ number: page.progress });
}

function openLink(page: DetectedPage) {
	void sendMessage({
		type: 'open:link',
		request: {
			site: page.site,
			identifier: page.identifier,
			title: page.title,
			mediaType: page.mediaType
		}
	});
}

async function detectWithRetry(adapter: SiteAdapter, isCurrent: () => boolean) {
	for (let attempt = 0; attempt < DETECT_MAX_TRIES && isCurrent(); attempt++) {
		try {
			const page = await adapter.detect(new URL(location.href), document);
			if (page) return page;
		} catch (error) {
			console.debug('[Acerola Sync] detect failed', error);
		}
		await new Promise((resolve) => setTimeout(resolve, DETECT_RETRY_MS));
	}
	return null;
}

/** Waits for the site trigger: time on the page (manga) or 85% of the video (anime). */
function waitForTrigger(adapter: SiteAdapter, onFire: () => void): Cancel {
	if (adapter.trigger === 'delay') {
		let timer: ReturnType<typeof setTimeout> | undefined;
		void storage.getItem<number>(STORAGE_KEYS.mangaDelaySeconds).then((seconds) => {
			timer = setTimeout(onFire, (seconds ?? DEFAULT_MANGA_DELAY_SECONDS) * 1000);
		});
		return () => clearTimeout(timer);
	}

	let fired = false;
	const check = () => {
		const video = [...document.querySelectorAll('video')].find((video) => video.duration > 0);
		if (!fired && video && video.currentTime / video.duration >= VIDEO_THRESHOLD) {
			fired = true;
			onFire();
		}
	};
	const interval = setInterval(check, 2000);
	return () => clearInterval(interval);
}

async function track(page: DetectedPage, resolved: Resolved) {
	const response = await sendMessage({
		type: 'track:progress',
		page,
		mediaId: resolved.media.id
	});
	if (response.status !== 'tracked') {
		if (response.status === 'error') {
			showToast({
				title: m['sync.tracking.failed'](),
				message: response.message,
				tone: 'error'
			});
		}
		return;
	}

	const { result } = response;
	if (!result.applied) return;
	// The server may convert the site's absolute numbering (E54) into the season episode (6).
	const saved = { ...page, progress: result.saved?.progress ?? page.progress };
	showToast({
		title: resolved.media.titleUserPreferred,
		message: result.saved?.pending
			? m['sync.tracking.saved.pending']({ unit: unitLabel(saved) })
			: m['sync.tracking.saved.label']({ unit: unitLabel(saved) }),
		tone: result.saved?.pending ? 'warning' : 'success',
		cover: resolved.media.coverUrl
	});
}

async function handlePage(adapter: SiteAdapter, isCurrent: () => boolean): Promise<Cancel | void> {
	const page = await detectWithRetry(adapter, isCurrent);
	if (!page || !isCurrent()) return;

	const response = await sendMessage({ type: 'track:resolve', page });
	if (!isCurrent()) return;

	if (response.status === 'unresolved') {
		showToast({
			title: m['sync.tracking.notFound']({ title: page.title }),
			tone: 'warning',
			actions: [{ label: m['sync.tracking.linkAction'](), onClick: () => openLink(page) }]
		});
		return;
	}
	if (response.status === 'error') {
		showToast({ title: m['sync.tracking.failed'](), message: response.message, tone: 'error' });
		return;
	}
	if (response.status !== 'resolved') return;

	const { resolved } = response;
	const linkedByHand = resolved.mapping.source === 'MANUAL';
	if (adapter.requireListMatch && !resolved.entry && !linkedByHand) return;

	// Already marked (or ahead): no need to wait for the trigger.
	if (resolved.entry && resolved.entry.progress >= page.progress) return;

	showToast({
		title: resolved.media.titleUserPreferred,
		message: m['sync.tracking.detected']({ unit: unitLabel(page) }),
		cover: resolved.media.coverUrl,
		actions: [
			{
				label: m['sync.tracking.wrongMedia'](),
				onClick: () => openLink(page),
				secondary: true
			}
		],
		durationMs: DETECTED_TOAST_MS
	});

	return waitForTrigger(adapter, () => void track(page, resolved));
}

/** What is open in the tab: the chapter/episode or, if not, the media page. */
async function currentPage(adapter: SiteAdapter): Promise<CurrentPage | null> {
	const url = new URL(location.href);
	try {
		if (adapter.pageKey(url)) {
			const page = await adapter.detect(url, document);
			if (page) return page;
		}
		return (await adapter.overview?.(url, document)) ?? null;
	} catch {
		return null;
	}
}

function openMedia(mediaId: number) {
	void sendMessage({ type: 'open:media', mediaId });
}

/** Card of this page's media: in the list (and where), out of it or not found. */
export async function describePage(page: CurrentPage): Promise<ToastOptions | null> {
	const linkPage = { ...page, progress: page.progress ?? 0 };
	const response = await sendMessage({ type: 'track:resolve', page: linkPage });
	if (response.status === 'unresolved') {
		return {
			title: m['sync.tracking.notFound']({ title: page.title }),
			tone: 'warning',
			actions: [{ label: m['sync.tracking.linkAction'](), onClick: () => openLink(linkPage) }]
		};
	}
	if (response.status === 'error') {
		return { title: m['sync.tracking.failed'](), message: response.message, tone: 'error' };
	}
	if (response.status !== 'resolved') return null;

	const { media, entry } = response.resolved;
	const unit = (number: number) =>
		page.mediaType === 'ANIME'
			? m['sync.tracking.episode']({ number })
			: m['sync.tracking.chapter']({ number });
	return {
		title: media.titleUserPreferred,
		message: entry
			? m['sync.tracking.inList']({ unit: unit(entry.progress) })
			: m['sync.tracking.notInList'](),
		tone: entry ? 'success' : 'info',
		cover: media.coverUrl,
		actions: [
			{ label: m['sync.tracking.openApp'](), onClick: () => openMedia(media.id) },
			{
				label: m['sync.tracking.wrongMedia'](),
				onClick: () => openLink(linkPage),
				secondary: true
			}
		]
	};
}

/** Media page: notifies once whether it is in the list (and where) or was not found. */
async function announceOverview(adapter: SiteAdapter) {
	const page = await currentPage(adapter);
	if (!page || page.progress !== null) return;
	const card = await describePage(page);
	if (card) void showToast({ ...card, id: HERE_TOAST_ID, durationMs: OVERVIEW_TOAST_MS });
}

/** Click on the floating button: opens (or closes) the media card, which stays until closed. */
async function toggleHereCard(adapter: SiteAdapter) {
	if (dismissToast(HERE_TOAST_ID)) return;
	const page = await currentPage(adapter);
	const card = page
		? await describePage(page)
		: ({ title: m['sync.tracking.nothingHere'](), tone: 'info' } satisfies ToastOptions);
	if (card) void showToast({ ...card, id: HERE_TOAST_ID, durationMs: null });
}

/** Custom site: only the URL is known (no cover, no reliable title). */
export function isCustomSite(adapter: Pick<SiteAdapter, 'id'>): boolean {
	return adapter.id.startsWith('custom:');
}

/**
 * Shows the floating button only where there is a media (media page, chapter or episode). The
 * page may still be loading (SPA): with no media, it tries again a bit later.
 *
 * On a custom site the button stays on every page and opens the extension: there the media card
 * cannot be built (no cover, uncertain title), and the popup already shows what it finds in the tab.
 */
async function refreshFab(adapter: SiteAdapter, retry = true) {
	if (isCustomSite(adapter)) {
		await setFab({
			icon: FAB_ICON,
			label: m['sync.tracking.fab.open'](),
			onClick: () => void sendMessage({ type: 'open:popup' })
		});
		return;
	}
	const href = location.href;
	const hasWork = Boolean(adapter.pageKey(new URL(href))) || Boolean(await currentPage(adapter));
	if (href !== location.href) return;
	if (!hasWork && retry) {
		setTimeout(() => {
			if (href === location.href) void refreshFab(adapter, false);
		}, DETECT_RETRY_MS);
	}
	await setFab(
		hasWork
			? {
					icon: FAB_ICON,
					label: m['sync.tracking.fab.label'](),
					onClick: () => void toggleHereCard(adapter)
				}
			: null
	);
}

/**
 * Content script loop: follows the URL (the sites are SPAs), detects the page and marks the
 * progress on the right trigger. Each episode/chapter change cancels the previous one.
 */
export function startTracking(adapter: SiteAdapter): void {
	let currentKey: string | null = null;
	let lastHref: string | null = null;
	let generation = 0;
	let cancel: Cancel | void;

	// The popup asks what is open to show this page's media.
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if ((message as { type?: string })?.type !== 'page:current') return;
		void currentPage(adapter).then(sendResponse);
		return true;
	});

	const tick = () => {
		const href = location.href;
		const key = adapter.pageKey(new URL(href));
		if (key === currentKey && href === lastHref) return;
		const hrefChanged = href !== lastHref;
		lastHref = href;
		if (hrefChanged) void refreshFab(adapter);
		if (key === currentKey) {
			if (!key && hrefChanged) void announceOverview(adapter);
			return;
		}

		currentKey = key;
		generation++;
		cancel?.();
		cancel = undefined;
		if (!key) {
			void announceOverview(adapter);
			return;
		}

		const mine = generation;
		void handlePage(adapter, () => mine === generation).then((stop) => {
			if (mine === generation) cancel = stop;
			else stop?.();
		});
	};

	tick();
	setInterval(tick, URL_POLL_MS);
}
