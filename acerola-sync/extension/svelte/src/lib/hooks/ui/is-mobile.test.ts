import { describe, expect, it, vi } from 'vitest';
import { IsMobile } from './is-mobile.svelte';

function mockMatchMedia(matches = false) {
	const matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn()
	}));

	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: matchMedia
	});

	return matchMedia;
}

describe('IsMobile', () => {
	it('uses default breakpoint below 768px', () => {
		const matchMedia = mockMatchMedia();

		new IsMobile();

		expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
	});

	it('uses custom breakpoint subtracting one pixel', () => {
		const matchMedia = mockMatchMedia(true);

		const query = new IsMobile(1024);

		expect(matchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
		expect(query.current).toBe(true);
	});
});
