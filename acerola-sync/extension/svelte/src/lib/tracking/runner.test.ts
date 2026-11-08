import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomSite } from '$lib/api/types';

const sendMessage = vi.fn(async (_message: unknown) => ({ status: 'unresolved' }));
const setFab = vi.fn(async (_options: unknown) => undefined);

vi.mock('wxt/browser', () => ({
	browser: {
		runtime: {
			getURL: (path: string) => `chrome-extension://acerola${path}`,
			onMessage: { addListener: vi.fn() }
		}
	}
}));
vi.mock('wxt/utils/storage', () => ({ storage: { getItem: vi.fn(async () => null) } }));
vi.mock('$lib/messaging', () => ({ sendMessage: (message: unknown) => sendMessage(message) }));
vi.mock('./toast', () => ({
	setFab: (options: unknown) => setFab(options),
	showToast: vi.fn(async () => undefined),
	dismissToast: vi.fn(() => false)
}));

const { isCustomSite, startTracking } = await import('./runner');
const { createCustomAdapter } = await import('./sites/custom');

const site: CustomSite = {
	id: '1',
	name: 'AnimeFire',
	mediaType: 'ANIME',
	matchPattern: 'https://animefire.one/*',
	urlPattern: '/(?<id>[\\w-]{11})/(?<progress>\\d+)',
	titleSelector: null,
	enabled: true
};

describe('runner — botão fixo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});
	afterEach(() => vi.useRealTimers());

	it('reconhece site personalizado pelo id', () => {
		expect(isCustomSite(createCustomAdapter(site))).toBe(true);
		expect(isCustomSite({ id: 'mangadex' })).toBe(false);
	});

	it('em site personalizado aparece em qualquer página e abre a extensão', async () => {
		// Página que não é episódio: mesmo assim o botão aparece.
		startTracking(createCustomAdapter(site));
		await vi.waitFor(() => expect(setFab).toHaveBeenCalled());

		const options = setFab.mock.calls.at(-1)![0] as { label: string; onClick: () => void };
		expect(options).not.toBeNull();
		expect(options.label).toMatch(/Abrir o Acerola Sync|Open Acerola Sync/);
		options.onClick();
		expect(sendMessage).toHaveBeenCalledWith({ type: 'open:popup' });
	});
});
