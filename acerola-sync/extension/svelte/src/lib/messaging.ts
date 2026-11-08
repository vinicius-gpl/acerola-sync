import type { CustomSite, MediaType, Resolved, TrackResult } from '$lib/api/types';
import type { CurrentPage, DetectedPage } from '$lib/tracking/types';
import { browser } from 'wxt/browser';

// Mensagens entre os contextos. O content script nunca fala com o server: pede ao background,
// que tem a sessão e a host permission.

export type ResolveResponse =
	| { status: 'resolved'; resolved: Resolved }
	| { status: 'unresolved' }
	| { status: 'logged-out' }
	| { status: 'disabled' }
	| { status: 'error'; message: string };

export type TrackResponse =
	| { status: 'tracked'; result: TrackResult }
	| { status: 'logged-out' }
	| { status: 'error'; message: string };

export type LinkRequest = {
	site: string;
	identifier: string;
	title: string;
	mediaType: MediaType;
};

export type ExtensionMessage =
	| { type: 'track:resolve'; page: DetectedPage }
	| { type: 'track:progress'; page: DetectedPage; mediaId: number }
	| { type: 'custom-sites:for-url'; url: string }
	| { type: 'custom-sites:refresh' }
	| { type: 'open:link'; request: LinkRequest }
	| { type: 'open:media'; mediaId: number }
	/** Botão fixo de site personalizado: abre o popup (ou a página cheia, se não der). */
	| { type: 'open:popup' }
	/** Popup → content script da aba: "o que está aberto aí?". */
	| { type: 'page:current' };

type ResponseOf<T extends ExtensionMessage['type']> = T extends 'track:resolve'
	? ResolveResponse
	: T extends 'track:progress'
		? TrackResponse
		: T extends 'custom-sites:for-url'
			? CustomSite[]
			: T extends 'page:current'
				? CurrentPage | null
				: void;

export function sendMessage<M extends ExtensionMessage>(
	message: M
): Promise<ResponseOf<M['type']>> {
	return browser.runtime.sendMessage(message) as Promise<ResponseOf<M['type']>>;
}

/**
 * Registra o roteador do background. Usa `sendResponse` + `return true` em vez de devolver a
 * Promise, porque o Chrome só passou a aceitar Promise no `onMessage` recentemente.
 */
export function onMessage(
	handler: (message: ExtensionMessage) => Promise<unknown> | unknown
): void {
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		Promise.resolve()
			.then(() => handler(message as ExtensionMessage))
			.then(sendResponse)
			.catch((error: unknown) =>
				sendResponse({
					status: 'error',
					message: error instanceof Error ? error.message : String(error)
				})
			);
		return true;
	});
}
