import { ApiError } from '$lib/api/client';

/**
 * Turns any error into one of the error screen variants (same table as the acerola-brand). The
 * screen never shows the raw error message: only the status code (as decoration) and a text that
 * says what to do.
 */
export type ErrorKind =
	| 'badRequest'
	| 'unauthorized'
	| 'forbidden'
	| 'notFound'
	| 'timeout'
	| 'tooMany'
	| 'server'
	| 'unavailable'
	| 'offline'
	| 'unknown';

/** What the primary action does: go home (the problem is what was opened) or try again. */
export type ErrorAction = 'home' | 'retry';

export type ScreenError = { status: number; kind: ErrorKind };

const BY_STATUS: Record<number, ErrorKind> = {
	400: 'badRequest',
	401: 'unauthorized',
	403: 'forbidden',
	404: 'notFound',
	408: 'timeout',
	429: 'tooMany',
	500: 'server',
	502: 'unavailable',
	503: 'unavailable',
	504: 'unavailable'
};

const RETRY: ErrorKind[] = ['timeout', 'tooMany', 'server', 'unavailable', 'offline', 'unknown'];

export function errorKind(status: number, online = true): ErrorKind {
	if (!online) return 'offline';
	if (BY_STATUS[status]) return BY_STATUS[status];
	if (status >= 500) return 'server';
	if (status >= 400) return 'badRequest';
	return 'unknown';
}

export function errorAction(kind: ErrorKind): ErrorAction {
	return RETRY.includes(kind) ? 'retry' : 'home';
}

/**
 * Error of a screen's main load. The API client reports "server did not answer" as status 0: with
 * internet it is the server that is down (503), without it the screen says offline.
 */
export function screenError(error: unknown, online = true): ScreenError {
	if (!online) return { status: 0, kind: 'offline' };
	if (!(error instanceof ApiError)) return { status: 500, kind: 'unknown' };
	if (error.status === 0) return { status: 503, kind: 'unavailable' };
	return { status: error.status, kind: errorKind(error.status) };
}
