import { browser } from 'wxt/browser';

const AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';

/**
 * AniList OAuth URL in implicit grant mode (the same as AniMouto): the token comes back in the
 * redirect fragment and needs no client secret. The extension only hands the token to the
 * server, which checks whose it is and stores it encrypted.
 */
export function buildAuthorizeUrl(clientId: string): string {
	const params = new URLSearchParams({ client_id: clientId.trim(), response_type: 'token' });
	return `${AUTHORIZE_URL}?${params}`;
}

/** Reads `#access_token=...` from the redirect. Returns `null` if the user denied or something went wrong. */
export function parseTokenFromRedirect(redirectUrl: string): string | null {
	const hash = redirectUrl.split('#')[1];
	if (!hash) return null;
	return new URLSearchParams(hash).get('access_token');
}

/** Redirect that must be registered in the AniList app. Changes per browser/install. */
export function getRedirectUrl(): string {
	return browser.identity.getRedirectURL();
}

export async function requestAnilistToken(clientId: string): Promise<string | null> {
	const redirect = await browser.identity.launchWebAuthFlow({
		url: buildAuthorizeUrl(clientId),
		interactive: true
	});
	return redirect ? parseTokenFromRedirect(redirect) : null;
}
