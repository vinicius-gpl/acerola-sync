import { describe, expect, it } from 'vitest';
import { matchesPattern, originPattern } from './match-pattern';

describe('matchesPattern', () => {
	it('confere esquema, host e caminho', () => {
		expect(matchesPattern('https://site.com/*', 'https://site.com/obra/1')).toBe(true);
		expect(matchesPattern('https://site.com/*', 'http://site.com/obra/1')).toBe(false);
		expect(matchesPattern('*://*.site.com/*', 'https://www.site.com/x')).toBe(true);
		expect(matchesPattern('*://*.site.com/*', 'https://site.com/x')).toBe(true);
		expect(matchesPattern('*://*.site.com/*', 'https://outrosite.com/x')).toBe(false);
		expect(matchesPattern('https://site.com/ler/*', 'https://site.com/obra/1')).toBe(false);
	});

	it('monta a origem para pedir permissão', () => {
		expect(originPattern('https://site.com/ler/*')).toBe('https://site.com/*');
		expect(originPattern('site.com')).toBeNull();
	});
});
