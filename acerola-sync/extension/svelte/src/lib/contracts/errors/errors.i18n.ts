import * as m from '$lib/paraglide/messages';
import type { ErrorPayload } from '$lib/contracts/shared/shared.payloads';

// Contract between the Rust error types (ComicError) and the Paraglide messages.
// The key is the exact value of the `errorType` field from the Tauri event payload.
export const COMIC_ERROR_MESSAGES: Record<string, () => string> = {
	AlreadyExists: m['tauriErrors.comic.alreadyExists.label'],
	SyncInProgress: m['tauriErrors.comic.syncIn.progress.label'],
	NotFound: m['tauriErrors.comic.notFound.label'],
	InvalidRequest: m['tauriErrors.comic.invalidRequest.label'],
	IntegrityViolation: m['tauriErrors.comic.integrityViolation.label'],
	SystemFailure: m['tauriErrors.comic.systemFailure.label'],
	Io: m['tauriErrors.comic.io.error.label']
};

// Resolves the translated message from the error payload.
// Falls back to Rust's technical `message` when the type is not mapped.
export function resolveErrorMessage(payload: ErrorPayload): string {
	return COMIC_ERROR_MESSAGES[payload.errorType]?.() ?? payload.message;
}
