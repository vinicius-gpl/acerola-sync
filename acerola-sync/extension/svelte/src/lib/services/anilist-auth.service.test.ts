import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

import { buildAuthorizeUrl, parseTokenFromRedirect } from './anilist-auth.service';

describe('anilist-auth.service', () => {
	it('monta a URL do implicit grant', () => {
		expect(buildAuthorizeUrl(' 123 ')).toBe(
			'https://anilist.co/api/v2/oauth/authorize?client_id=123&response_type=token'
		);
	});

	it('lê o token do fragmento do redirect', () => {
		expect(
			parseTokenFromRedirect(
				'https://abc.chromiumapp.org/#access_token=tok&token_type=Bearer&expires_in=31536000'
			)
		).toBe('tok');
		expect(parseTokenFromRedirect('https://abc.chromiumapp.org/?error=access_denied')).toBeNull();
	});
});
