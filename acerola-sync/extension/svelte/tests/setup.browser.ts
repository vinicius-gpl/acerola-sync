import { vi } from 'vitest';

// Mock do storage do WXT — em jsdom não existe `chrome.storage`. Comportamento padrão:
// retorna null (sem valor salvo), igual ao mock do store do Tauri no acerola-reader.
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn().mockResolvedValue(null),
		setItem: vi.fn().mockResolvedValue(undefined)
	}
}));
