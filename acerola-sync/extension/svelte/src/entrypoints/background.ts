import { ApiError } from '$lib/api/client';
import type { CustomSite } from '$lib/api/types';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { onMessage, type ExtensionMessage, type LinkRequest } from '$lib/messaging';
import { m } from '$lib/paraglide/messages';
import {
	addNotifications,
	checkAiring,
	notificationId,
	type NotificationItem
} from '$lib/services/airing.service';
import { getAuthedApi, saveSession } from '$lib/services/session.service';
import { matchesPattern, originPattern } from '$lib/tracking/match-pattern';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';

const CUSTOM_SCRIPT_PREFIX = 'acerola-custom-';

/** Session revoked or expired: clear it so the popup goes back to the login screen. */
async function handleApiError(error: unknown) {
	if (error instanceof ApiError && error.isUnauthorized) {
		await saveSession(null);
		return { status: 'logged-out' as const };
	}
	return {
		status: 'error' as const,
		message: error instanceof Error ? error.message : String(error)
	};
}

async function isSiteDisabled(site: string) {
	const disabled = (await storage.getItem<string[]>(STORAGE_KEYS.disabledSites)) ?? [];
	return disabled.includes(site);
}

async function enabledCustomSites(): Promise<CustomSite[]> {
	const sites = (await storage.getItem<CustomSite[]>(STORAGE_KEYS.customSites)) ?? [];
	return sites.filter((site) => site.enabled);
}

/**
 * Registers the generic content script (`custom.content.ts`) on custom sites that already have
 * permission. Without permission Chrome refuses the registration, so those stay out until the
 * user grants it on the settings screen.
 */
async function syncCustomScripts() {
	if (!browser.scripting?.registerContentScripts) return;

	const registered = await browser.scripting.getRegisteredContentScripts();
	const ours = registered.filter((script) => script.id.startsWith(CUSTOM_SCRIPT_PREFIX));
	if (ours.length) {
		await browser.scripting.unregisterContentScripts({ ids: ours.map((script) => script.id) });
	}

	const scripts = [];
	for (const site of await enabledCustomSites()) {
		const origin = originPattern(site.matchPattern);
		if (!origin || !(await browser.permissions.contains({ origins: [origin] }))) continue;
		scripts.push({
			id: `${CUSTOM_SCRIPT_PREFIX}${site.id}`,
			matches: [site.matchPattern],
			js: ['content-scripts/custom.js'],
			runAt: 'document_idle' as const,
			persistAcrossSessions: true
		});
	}
	if (scripts.length) await browser.scripting.registerContentScripts(scripts);
}

function openLinkPage(request: LinkRequest) {
	const params = new URLSearchParams({ link: JSON.stringify(request) });
	return browser.tabs.create({ url: browser.runtime.getURL(`/app.html?${params}`) });
}

/**
 * "Open in Acerola" from the on-site notice: opens the media in the extension popup. The popup
 * reads the pending media when it opens. If the browser does not allow opening the popup from
 * here (Firefox, older Chrome), it falls back to the full page.
 */
async function openMedia(mediaId: number) {
	await storage.setItem(STORAGE_KEYS.pendingMedia, { mediaId, at: Date.now() });
	if (!(await openPopup())) {
		await storage.removeItem(STORAGE_KEYS.pendingMedia);
		await browser.tabs.create({ url: browser.runtime.getURL(`/app.html?media=${mediaId}`) });
	}
}

/** Opens the extension popup. `false` when the browser does not allow it (Firefox, older Chrome). */
async function openPopup(): Promise<boolean> {
	try {
		await (browser.action as { openPopup?: () => Promise<void> }).openPopup!();
		return true;
	} catch {
		return false;
	}
}

const AIRING_ALARM = 'airing-check';
const AIRING_EVERY_MINUTES = 15;
const NOTIFICATION_PREFIX = 'airing:';

/** Icon badge: how many media have a new episode beyond the progress. */
async function setBadge(count: number) {
	await browser.action.setBadgeText({ text: count > 0 ? String(count) : '' });
	await browser.action.setBadgeBackgroundColor({ color: '#40a02b' }); // design-allow: icon badge color (browser API, no CSS); theme green
	await browser.action.setTitle({
		title: count > 0 ? m['sync.airing.badge']({ count }) : 'Acerola Sync'
	});
}

/**
 * Checks what aired for the anime in progress: updates the badge and sends a system
 * notification for each episode aired since the last check. Clicking it opens the media
 * (where to watch).
 */
async function checkAiringNow() {
	const api = await getAuthedApi();
	if (!api) return setBadge(0);
	try {
		const lists = await Promise.all(
			(['CURRENT', 'REPEATING'] as const).map((status) =>
				api.entries({ mediaType: 'ANIME', status, limit: 200 })
			)
		);
		const seen = (await storage.getItem<Record<string, number>>(STORAGE_KEYS.airingSeen)) ?? {};
		const result = checkAiring(lists.flat(), seen, Date.now());
		await storage.setItem(STORAGE_KEYS.airingSeen, result.seen);
		await setBadge(result.behind);
		if (result.fresh.length) {
			const saved =
				(await storage.getItem<NotificationItem[]>(STORAGE_KEYS.notifications)) ?? [];
			await storage.setItem(
				STORAGE_KEYS.notifications,
				addNotifications(saved, result.fresh, Date.now())
			);
		}
		for (const episode of result.fresh) {
			await browser.notifications.create(notificationId(episode), {
				type: 'basic',
				iconUrl: browser.runtime.getURL('/icon/128.png'),
				title: episode.title,
				message: m['sync.airing.episode']({ episode: episode.episode })
			});
		}
	} catch (error) {
		console.warn('[Background] Airing check failed', error);
	}
}

async function handle(message: ExtensionMessage) {
	switch (message.type) {
		case 'track:resolve': {
			if (await isSiteDisabled(message.page.site)) return { status: 'disabled' };
			const api = await getAuthedApi();
			if (!api) return { status: 'logged-out' };
			try {
				const { page } = message;
				const resolved = await api.resolve({
					site: page.site,
					identifier: page.identifier,
					title: page.title,
					mediaType: page.mediaType,
					anilistId: page.anilistId
				});
				return resolved ? { status: 'resolved', resolved } : { status: 'unresolved' };
			} catch (error) {
				return handleApiError(error);
			}
		}

		case 'track:progress': {
			const api = await getAuthedApi();
			if (!api) return { status: 'logged-out' };
			try {
				const result = await api.track({
					site: message.page.site,
					mediaId: message.mediaId,
					progress: message.page.progress,
					url: message.page.url
				});
				void checkAiringNow();
				return { status: 'tracked', result };
			} catch (error) {
				return handleApiError(error);
			}
		}

		case 'custom-sites:for-url':
			return (await enabledCustomSites()).filter((site) =>
				matchesPattern(site.matchPattern, message.url)
			);

		case 'custom-sites:refresh':
			await syncCustomScripts();
			return;

		case 'open:link':
			await openLinkPage(message.request);
			return;

		case 'open:media':
			await openMedia(message.mediaId);
			return;

		case 'open:popup':
			if (!(await openPopup()))
				await browser.tabs.create({ url: browser.runtime.getURL('/app.html') });
			return;
	}
}

export default defineBackground(() => {
	console.info('[Background] Acerola Sync service worker started');

	onMessage(handle);

	browser.runtime.onInstalled.addListener(() => void syncCustomScripts());
	browser.runtime.onStartup.addListener(() => void syncCustomScripts());

	// New episode: check on startup, every 15 min and when the popup closes (the progress may
	// have changed there). The alarm survives the service worker going to sleep.
	void browser.alarms.create(AIRING_ALARM, { periodInMinutes: AIRING_EVERY_MINUTES });
	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === AIRING_ALARM) void checkAiringNow();
	});
	browser.runtime.onConnect.addListener((port) => {
		if (port.name === 'popup') port.onDisconnect.addListener(() => void checkAiringNow());
	});
	browser.notifications.onClicked.addListener((id) => {
		if (!id.startsWith(NOTIFICATION_PREFIX)) return;
		void browser.notifications.clear(id);
		void openMedia(Number(id.slice(NOTIFICATION_PREFIX.length).split(':')[0]));
	});
	void checkAiringNow();
	browser.permissions.onAdded.addListener(() => void syncCustomScripts());
	storage.watch(STORAGE_KEYS.customSites, () => void syncCustomScripts());
});
