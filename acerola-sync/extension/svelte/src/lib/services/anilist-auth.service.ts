import { browser } from 'wxt/browser';

const AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';

/**
 * URL do OAuth do AniList no modo implicit grant (o mesmo do AniMouto): o token volta no
 * fragmento do redirect e não precisa de client secret. A extensão só repassa o token ao
 * server, que confere de quem é e guarda criptografado.
 */
export function buildAuthorizeUrl(clientId: string): string {
	const params = new URLSearchParams({ client_id: clientId.trim(), response_type: 'token' });
	return `${AUTHORIZE_URL}?${params}`;
}

/** Lê `#access_token=...` do redirect. Devolve `null` se o usuário negou ou algo deu errado. */
export function parseTokenFromRedirect(redirectUrl: string): string | null {
	const hash = redirectUrl.split('#')[1];
	if (!hash) return null;
	return new URLSearchParams(hash).get('access_token');
}

/** Redirect que precisa estar cadastrado no app do AniList. Muda por navegador/instalação. */
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
