import paletteCss from '$theme/colors/catppuccin.css?inline';
import { resolveMode, type ThemeModeOption } from '$lib/hooks/theme/use-theme.svelte';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { m } from '$lib/paraglide/messages';
import { storage } from 'wxt/utils/storage';

// Aviso no canto da página do site, com o mesmo desenho dos cartões do app: raio de cartão,
// sem borda, cor do estado no fundo (`*-soft`) e no texto. Embaixo dos avisos fica o botão
// fixo do Acerola (como o lápis do MALSync). É DOM puro num shadow root: o CSS do site não
// vaza para dentro e o nosso não vaza para fora. As cores vêm do próprio `catppuccin.css` do
// tema (injetado no shadow root), nunca escritas aqui.

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export type ToastAction = { label: string; onClick: () => void; secondary?: boolean };

export type ToastOptions = {
	title: string;
	message?: string;
	tone?: ToastTone;
	cover?: string | null;
	actions?: ToastAction[];
	/** Tempo na tela; `null` fica até fechar. */
	durationMs?: number | null;
	/** Um aviso com o mesmo id troca o anterior em vez de empilhar. */
	id?: string;
};

export const DEFAULT_TOAST_MS = 9000;

const TONE_VARS: Record<ToastTone, { bg: string; fg: string }> = {
	info: { bg: 'var(--card)', fg: 'var(--foreground)' },
	success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
	warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
	error: { bg: 'var(--destructive-soft)', fg: 'var(--destructive)' }
};

const STYLE = `
	${paletteCss}
	.dock { display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
		font-family: 'DM Sans Variable', system-ui, sans-serif; }
	.stack { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
	.toast { position: relative; display: flex; align-items: center; gap: 16px; width: 400px;
		max-width: calc(100vw - 32px); box-sizing: border-box; padding: 14px 20px 14px 14px;
		border-radius: 28px; background: var(--tone-bg); color: var(--tone-fg); font-size: 15px;
		line-height: 1.4; box-shadow: 0 16px 40px -12px color-mix(in srgb, var(--crust) 90%, transparent);
		animation: in 260ms cubic-bezier(.2,.8,.2,1); }
	.toast img { width: 60px; height: 86px; object-fit: cover; border-radius: 16px; flex: none; }
	.badge { width: 48px; height: 48px; border-radius: 999px; flex: none; display: grid; place-items: center;
		background: color-mix(in srgb, var(--tone-fg) 18%, transparent); font-weight: 900; font-size: 18px; }
	.body { flex: 1; min-width: 0; }
	.title { font-size: 17px; font-weight: 900; letter-spacing: -0.01em; color: var(--foreground);
		padding-right: 20px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
		overflow: hidden; overflow-wrap: anywhere; }
	.message { margin-top: 2px; opacity: .9; }
	.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
	.actions button { border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer;
		background: var(--primary); color: var(--primary-foreground); font: inherit; font-size: 13px; font-weight: 800; }
	.actions button.secondary { background: color-mix(in srgb, var(--foreground) 10%, transparent); color: var(--foreground); }
	.actions button:hover { filter: brightness(1.08); }
	.close { position: absolute; top: 10px; right: 12px; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px;
		display: grid; place-items: center; cursor: pointer; background: transparent; color: var(--foreground);
		opacity: .7; }
	.close svg { display: block; }
	.close:hover { opacity: 1; background: color-mix(in srgb, var(--foreground) 10%, transparent); }
	.fab { width: 52px; height: 52px; border: 0; border-radius: 999px; padding: 0; cursor: pointer;
		display: grid; place-items: center; background: var(--card);
		box-shadow: 0 16px 40px -12px color-mix(in srgb, var(--crust) 90%, transparent);
		transition: transform 180ms cubic-bezier(.2,.8,.2,1); animation: in 260ms cubic-bezier(.2,.8,.2,1); }
	.fab:hover { transform: scale(1.08); }
	.fab:active { transform: scale(.94); }
	.fab:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
	.fab { opacity: .6; transition: transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms; }
	.fab:hover, .fab:focus-visible { opacity: 1; }
	.fab img { width: 30px; height: 30px; }
	.fab[hidden] { display: none; }
	@keyframes in { from { opacity: 0; transform: translateY(12px) scale(.96); } }
	@media (prefers-reduced-motion: reduce) { .toast, .fab { animation: none; transition: none; } }
`;

const CLOSE_ICON =
	'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.25" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const BADGE: Record<ToastTone, string> = { info: 'i', success: '✓', warning: '!', error: '×' };

let host: HTMLElement | null = null;
let dock: HTMLElement | null = null;

async function currentMode() {
	const saved = await storage.getItem<ThemeModeOption>(STORAGE_KEYS.mode);
	return resolveMode(saved ?? 'dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
}

async function ensureDock(): Promise<HTMLElement> {
	if (dock && host?.isConnected) return dock;
	host = document.createElement('acerola-sync-toast');
	host.style.cssText =
		'all: initial; position: fixed; z-index: 2147483647; bottom: 16px; right: 16px;';
	const root = host.attachShadow({ mode: 'open' });
	const style = document.createElement('style');
	style.textContent = STYLE;
	dock = document.createElement('div');
	dock.className = 'dock';
	dock.dataset.theme = await currentMode();
	const stack = document.createElement('div');
	stack.className = 'stack';
	dock.append(stack);
	root.append(style, dock);
	document.documentElement.append(host);
	return dock;
}

function closeToast(toast: HTMLElement) {
	clearTimeout(Number(toast.dataset.timer));
	toast.remove();
}

export async function showToast(options: ToastOptions): Promise<HTMLElement> {
	const container = (await ensureDock()).querySelector<HTMLElement>('.stack')!;
	const tone = options.tone ?? 'info';
	const toast = document.createElement('div');
	toast.className = 'toast';
	toast.setAttribute('role', 'status');
	toast.style.setProperty('--tone-bg', TONE_VARS[tone].bg);
	toast.style.setProperty('--tone-fg', TONE_VARS[tone].fg);

	if (options.cover) {
		const img = document.createElement('img');
		img.src = options.cover;
		img.alt = '';
		toast.append(img);
	} else {
		const badge = document.createElement('span');
		badge.className = 'badge';
		badge.textContent = BADGE[tone];
		toast.append(badge);
	}

	const body = document.createElement('div');
	body.className = 'body';
	const title = document.createElement('div');
	title.className = 'title';
	title.textContent = options.title;
	body.append(title);
	if (options.message) {
		const message = document.createElement('div');
		message.className = 'message';
		message.textContent = options.message;
		body.append(message);
	}
	if (options.actions?.length) {
		const actions = document.createElement('div');
		actions.className = 'actions';
		for (const action of options.actions) {
			const button = document.createElement('button');
			button.textContent = action.label;
			if (action.secondary) button.className = 'secondary';
			button.addEventListener('click', () => {
				action.onClick();
				closeToast(toast);
			});
			actions.append(button);
		}
		body.append(actions);
	}
	toast.append(body);

	const close = document.createElement('button');
	close.className = 'close';
	// X desenhado (traço grosso, centrado na caixa): o "×" da fonte ficava fino e torto.
	close.innerHTML = CLOSE_ICON;
	close.setAttribute('aria-label', m['sync.tracking.close']());
	close.addEventListener('click', () => closeToast(toast));
	toast.append(close);

	if (options.id) {
		toast.dataset.id = options.id;
		const previous = [...container.children].find(
			(child) => (child as HTMLElement).dataset.id === options.id
		);
		if (previous) closeToast(previous as HTMLElement);
	}
	container.append(toast);

	const duration = options.durationMs === undefined ? DEFAULT_TOAST_MS : options.durationMs;
	if (duration !== null) toast.dataset.timer = String(setTimeout(() => toast.remove(), duration));
	return toast;
}

/** Fecha o aviso com esse id, se estiver na tela. Devolve se havia um. */
export function dismissToast(id: string): boolean {
	const toast = dock?.querySelector<HTMLElement>(`.toast[data-id="${CSS.escape(id)}"]`);
	if (!toast) return false;
	closeToast(toast);
	return true;
}

/**
 * Botão fixo do Acerola no canto da página. `null` esconde (página sem obra); com um handler,
 * mostra e troca o clique.
 */
export async function setFab(
	options: { icon: string; label: string; onClick: () => void } | null
): Promise<void> {
	if (!options && !dock) return;
	const container = await ensureDock();
	let fab = container.querySelector<HTMLButtonElement>('.fab');
	if (!options) {
		if (fab) fab.hidden = true;
		return;
	}
	if (!fab) {
		fab = document.createElement('button');
		fab.className = 'fab';
		const img = document.createElement('img');
		img.alt = '';
		fab.append(img);
		container.append(fab);
	}
	fab.querySelector('img')!.src = options.icon;
	fab.title = options.label;
	fab.setAttribute('aria-label', options.label);
	fab.onclick = options.onClick;
	fab.hidden = false;
}
