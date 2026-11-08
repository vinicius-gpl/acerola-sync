import { beforeEach, describe, expect, it, vi } from 'vitest';

const stored: Record<string, unknown> = {};
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn((key: string) => Promise.resolve(stored[key] ?? null)),
		setItem: vi.fn((key: string, value: unknown) => {
			stored[key] = value;
			return Promise.resolve();
		})
	}
}));

import { initTheme, resolveMode, useTheme } from './use-theme.svelte';

function mockSystemDark(dark: boolean) {
	window.matchMedia = vi.fn().mockReturnValue({
		matches: dark,
		addEventListener: vi.fn()
	}) as unknown as typeof window.matchMedia;
}

describe('useTheme', () => {
	beforeEach(() => {
		for (const key of Object.keys(stored)) delete stored[key];
		document.documentElement.removeAttribute('data-theme');
		document.documentElement.classList.remove('dark');
	});

	it('resolve o modo do sistema', () => {
		expect(resolveMode('system', true)).toBe('dark');
		expect(resolveMode('system', false)).toBe('light');
		expect(resolveMode('light', true)).toBe('light');
	});

	it('aplica o modo salvo no data-theme', async () => {
		mockSystemDark(false);
		stored['local:mode'] = 'light';
		await initTheme();

		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('troca e salva o modo', async () => {
		mockSystemDark(true);
		const theme = useTheme();
		await theme.setMode('system');

		expect(stored['local:mode']).toBe('system');
		expect(theme.resolved).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});
});
