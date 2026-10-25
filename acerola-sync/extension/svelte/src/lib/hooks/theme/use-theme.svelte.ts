import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { THEMES } from '$lib/constants/themes';
import { storage } from 'wxt/utils/storage';

export type ThemeColor = keyof typeof THEMES;
export type ThemeMode = keyof (typeof THEMES)[keyof typeof THEMES];
export type ThemeModeOption = ThemeMode | 'system';

const browser = typeof window !== 'undefined';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

let theme = $state<ThemeColor>('catppuccin');
let mode = $state<ThemeModeOption>('dark');
let resolved = $state<ThemeMode>('dark');

function applyTheme(color: ThemeColor, modeOption: ThemeModeOption) {
	if (!browser) return;

	let newResolvedMode: ThemeMode = modeOption as ThemeMode;

	// Sem janela do Tauri: o modo do sistema vem do `prefers-color-scheme` da página.
	if (modeOption === 'system') {
		newResolvedMode = window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
	}

	resolved = newResolvedMode;

	const root = document.documentElement;
	root.setAttribute('data-theme', THEMES[color][resolved]);
	root.classList.toggle('dark', resolved === 'dark');
}

// prettier-ignore
browser && (async () => {
    const [savedTheme, savedMode] = await Promise.all([
      storage.getItem<ThemeColor>(STORAGE_KEYS.theme),
      storage.getItem<ThemeModeOption>(STORAGE_KEYS.mode),
    ]);

    if (savedTheme) theme = savedTheme;
    if (savedMode) mode = savedMode;

    applyTheme(theme, mode);

    window.matchMedia(SYSTEM_DARK_QUERY).addEventListener('change', () => {
      if (mode === "system") {
        applyTheme(theme, "system");
      }
    });
  })();

export function useTheme() {
	async function setTheme(newTheme: ThemeColor) {
		theme = newTheme;
		await storage.setItem(STORAGE_KEYS.theme, newTheme);
		applyTheme(theme, mode);
	}

	async function setMode(newMode: ThemeModeOption) {
		mode = newMode;
		await storage.setItem(STORAGE_KEYS.mode, newMode);
		applyTheme(theme, mode);
	}

	return {
		setMode,
		setTheme,
		get resolved() {
			return resolved;
		},
		get theme() {
			return theme;
		},
		get mode() {
			return mode;
		}
	};
}
