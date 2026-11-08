import { ApiError } from '$lib/api/client';
import type { CustomSite } from '$lib/api/types';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { onMessage, type ExtensionMessage, type LinkRequest } from '$lib/messaging';
import { getAuthedApi, saveSession } from '$lib/services/session.service';
import { matchesPattern, originPattern } from '$lib/tracking/match-pattern';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';

const CUSTOM_SCRIPT_PREFIX = 'acerola-custom-';

/** Sessão revogada ou expirada: limpa para o popup voltar à tela de login. */
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
 * Registra o content script genérico (`custom.content.ts`) nos sites personalizados que já
 * têm permissão. Sem permissão o Chrome recusa o registro, então esses ficam de fora até o
 * usuário conceder na tela de configurações.
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
 * "Abrir no Acerola" do aviso no site: abre a obra no popup da extensão. O popup lê a obra
 * pendente ao abrir. Se o navegador não deixar abrir o popup daqui (Firefox, Chrome antigo),
 * cai na página cheia.
 */
async function openMedia(mediaId: number) {
	await storage.setItem(STORAGE_KEYS.pendingMedia, { mediaId, at: Date.now() });
	if (!(await openPopup())) {
		await storage.removeItem(STORAGE_KEYS.pendingMedia);
		await browser.tabs.create({ url: browser.runtime.getURL(`/app.html?media=${mediaId}`) });
	}
}

/** Abre o popup da extensão. `false` quando o navegador não deixa (Firefox, Chrome antigo). */
async function openPopup(): Promise<boolean> {
	try {
		await (browser.action as { openPopup?: () => Promise<void> }).openPopup!();
		return true;
	} catch {
		return false;
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
	browser.permissions.onAdded.addListener(() => void syncCustomScripts());
	storage.watch(STORAGE_KEYS.customSites, () => void syncCustomScripts());
});
