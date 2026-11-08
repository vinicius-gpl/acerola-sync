import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn(async (key: string) => (key === 'local:mode' ? 'dark' : store.get(key))),
		setItem: vi.fn(async (key: string, value: unknown) => void store.set(key, value))
	}
}));

const { DEFAULT_TOAST_MS, dismissToast, positionFromRect, setFab, showToast } =
	await import('./toast');

function shadow() {
	return document.querySelector('acerola-sync-toast')!.shadowRoot!;
}

describe('toast do site', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		window.matchMedia ??= (() => ({ matches: true })) as unknown as typeof window.matchMedia;
	});
	afterEach(() => {
		vi.useRealTimers();
		document.querySelector('acerola-sync-toast')?.remove();
		store.clear();
	});

	it('some depois do tempo padrão (9s)', async () => {
		await showToast({ title: 'Chainsaw Man', tone: 'success' });
		expect(DEFAULT_TOAST_MS).toBe(9000);
		vi.advanceTimersByTime(DEFAULT_TOAST_MS - 1);
		expect(shadow().querySelectorAll('.toast')).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(shadow().querySelectorAll('.toast')).toHaveLength(0);
	});

	it('com durationMs null fica até fechar no ×', async () => {
		await showToast({ title: 'Fixo', durationMs: null });
		vi.advanceTimersByTime(60_000);
		const toast = shadow().querySelector('.toast')!;
		toast.querySelector<HTMLButtonElement>('.close')!.click();
		expect(shadow().querySelector('.toast')).toBeNull();
	});

	it('mesmo id troca o aviso em vez de empilhar e dismissToast fecha', async () => {
		await showToast({ title: 'Um', id: 'here' });
		await showToast({ title: 'Dois', id: 'here' });
		const toasts = shadow().querySelectorAll('.toast');
		expect(toasts).toHaveLength(1);
		expect(toasts[0].querySelector('.title')!.textContent).toBe('Dois');
		expect(dismissToast('here')).toBe(true);
		expect(dismissToast('here')).toBe(false);
	});

	it('cada ação vira um botão que roda e fecha o aviso', async () => {
		const open = vi.fn();
		await showToast({
			title: 'Obra',
			actions: [
				{ label: 'Abrir', onClick: open },
				{ label: 'Não é essa?', onClick: vi.fn(), secondary: true }
			]
		});
		const buttons = shadow().querySelectorAll<HTMLButtonElement>('.actions button');
		expect(buttons).toHaveLength(2);
		expect(buttons[1].className).toBe('secondary');
		buttons[0].click();
		expect(open).toHaveBeenCalledOnce();
		expect(shadow().querySelector('.toast')).toBeNull();
	});

	it('botão fixo aparece com o ícone, chama o clique e some com null', async () => {
		const onClick = vi.fn();
		await setFab({ icon: 'chrome-extension://x/icon/96.png', label: 'Acerola', onClick });
		const fab = shadow().querySelector<HTMLButtonElement>('.fab')!;
		expect(fab.hidden).toBe(false);
		expect(fab.querySelector('img')!.getAttribute('src')).toContain('icon/96.png');
		fab.click();
		expect(onClick).toHaveBeenCalledOnce();
		await setFab(null);
		expect(fab.hidden).toBe(true);
	});

	it('o botão fica abaixo dos avisos', async () => {
		await setFab({ icon: 'x.png', label: 'Acerola', onClick: vi.fn() });
		await showToast({ title: 'Depois' });
		const dock = shadow().querySelector('.dock')!;
		expect(dock.lastElementChild!.className).toBe('fab');
	});

	it('sem posição salva fica no canto inferior direito', async () => {
		await setFab({ icon: 'x.png', label: 'Acerola', onClick: vi.fn() });
		const host = document.querySelector<HTMLElement>('acerola-sync-toast')!;
		expect(host.style.right).toBe('16px');
		expect(host.style.bottom).toBe('16px');
		expect(shadow().querySelector<HTMLElement>('.dock')!.dataset).toMatchObject({
			x: 'right',
			y: 'bottom'
		});
	});

	it('usa a posição salva deste site e os avisos abrem do lado do botão', async () => {
		store.set('sync:fabPositions', {
			[location.hostname]: { x: 'left', y: 'top', dx: 40, dy: 120 },
			'outro.site': { x: 'right', y: 'bottom', dx: 300, dy: 300 }
		});
		await setFab({ icon: 'x.png', label: 'Acerola', onClick: vi.fn() });
		const host = document.querySelector<HTMLElement>('acerola-sync-toast')!;
		expect(host.style.left).toBe('40px');
		expect(host.style.top).toBe('120px');
		expect(host.style.right).toBe('auto');
		expect(shadow().querySelector<HTMLElement>('.dock')!.dataset).toMatchObject({
			x: 'left',
			y: 'top'
		});
	});

	it('Ctrl + clique não abre nada; clique normal abre', async () => {
		const onClick = vi.fn();
		await setFab({ icon: 'x.png', label: 'Acerola', onClick });
		const fab = shadow().querySelector<HTMLButtonElement>('.fab')!;
		fab.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
		expect(onClick).not.toHaveBeenCalled();
		fab.click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('Ctrl + duplo clique esquece a posição do site e volta ao canto', async () => {
		store.set('sync:fabPositions', {
			[location.hostname]: { x: 'left', y: 'top', dx: 40, dy: 120 }
		});
		await setFab({ icon: 'x.png', label: 'Acerola', onClick: vi.fn() });
		const fab = shadow().querySelector<HTMLButtonElement>('.fab')!;
		fab.dispatchEvent(new MouseEvent('dblclick', { ctrlKey: true }));
		await vi.waitFor(() => expect(store.get('sync:fabPositions')).toEqual({}));
		const host = document.querySelector<HTMLElement>('acerola-sync-toast')!;
		expect(host.style.right).toBe('16px');
		expect(host.style.bottom).toBe('16px');
	});
});

describe('positionFromRect', () => {
	const viewport = { width: 1000, height: 800 };

	it('mede até o canto mais perto do centro do botão', () => {
		expect(positionFromRect({ left: 900, top: 700, width: 52, height: 52 }, viewport)).toEqual({
			x: 'right',
			y: 'bottom',
			dx: 48,
			dy: 48
		});
		expect(positionFromRect({ left: 30, top: 20, width: 52, height: 52 }, viewport)).toEqual({
			x: 'left',
			y: 'top',
			dx: 30,
			dy: 20
		});
	});
});
