import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { storage } from 'wxt/utils/storage';

// Same single palette as acerola-reader: only the mode switches (light/dark), not the theme.
export type ThemeMode = 'light' | 'dark';
export type ThemeModeOption = ThemeMode | 'system';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

let mode = $state<ThemeModeOption>('dark');
let resolved = $state<ThemeMode>('dark');

export function resolveMode(option: ThemeModeOption, systemDark: boolean): ThemeMode {
	if (option === 'system') return systemDark ? 'dark' : 'light';
	return option;
}

function applyTheme(option: ThemeModeOption) {
	if (typeof window === 'undefined') return;

	resolved = resolveMode(option, window.matchMedia(SYSTEM_DARK_QUERY).matches);

	const root = document.documentElement;
	root.setAttribute('data-theme', resolved);
	root.classList.toggle('dark', resolved === 'dark');
}

/** Reads the saved mode and applies it. Called once per page (popup and full page). */
export async function initTheme() {
	if (typeof window === 'undefined') return;

	const saved = await storage.getItem<ThemeModeOption>(STORAGE_KEYS.mode);
	if (saved) mode = saved;
	applyTheme(mode);

	window.matchMedia(SYSTEM_DARK_QUERY).addEventListener('change', () => {
		if (mode === 'system') applyTheme('system');
	});
}

export function useTheme() {
	async function setMode(newMode: ThemeModeOption) {
		mode = newMode;
		await storage.setItem(STORAGE_KEYS.mode, newMode);
		applyTheme(mode);
	}

	return {
		setMode,
		get resolved() {
			return resolved;
		},
		get mode() {
			return mode;
		}
	};
}
