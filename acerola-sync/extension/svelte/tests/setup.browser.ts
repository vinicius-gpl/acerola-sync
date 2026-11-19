import { vi } from 'vitest';

// WXT storage mock: jsdom has no `chrome.storage`. Default behavior: returns null (no saved
// value), like the Tauri store mock in acerola-reader.
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn().mockResolvedValue(null),
		setItem: vi.fn().mockResolvedValue(undefined)
	}
}));
