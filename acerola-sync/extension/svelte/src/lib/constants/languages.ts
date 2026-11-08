export const LANGUAGES = [
	{ code: 'pt-br', label: 'Português (BR)' },
	{ code: 'en', label: 'English' },
	{ code: 'es-la', label: 'Español (LA)' },
	{ code: 'es', label: 'Español' },
	{ code: 'fr', label: 'Français' },
	{ code: 'it', label: 'Italiano' },
	{ code: 'de', label: 'Deutsch' },
	{ code: 'ru', label: 'Русский' },
	{ code: 'ja', label: '日本語' },
	{ code: 'ko', label: '한국어' },
	{ code: 'zh', label: '中文' },
	{ code: 'id', label: 'Indonesia' }
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
