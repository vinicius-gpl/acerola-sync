import gsap from 'gsap';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countUp, pop, prefersReducedMotion, revealIn, spinWhile, staggerIn } from './motion.utils';

vi.mock('gsap', () => {
	const tween = { kill: vi.fn() };
	return {
		default: {
			fromTo: vi.fn(() => tween),
			to: vi.fn((target: { value?: number }, vars: { value?: number; onUpdate?: () => void }) => {
				if (vars.value !== undefined) {
					target.value = vars.value;
					vars.onUpdate?.();
				}
				return tween;
			})
		}
	};
});

function reduceMotion(reduce: boolean) {
	window.matchMedia = ((query: string) => ({
		matches: reduce && query.includes('reduce'),
		addEventListener: () => {}
	})) as unknown as typeof window.matchMedia;
}

describe('motion.utils', () => {
	beforeEach(() => {
		vi.mocked(gsap.fromTo).mockClear();
		vi.mocked(gsap.to).mockClear();
		reduceMotion(false);
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			callback(0);
			return 0;
		});
	});

	it('anima os filhos em cascata e de novo quando a chave muda', () => {
		const node = document.createElement('div');
		node.append(document.createElement('span'), document.createElement('span'));

		const action = staggerIn(node, { key: 'a' });
		expect(gsap.fromTo).toHaveBeenCalledTimes(1);
		expect(vi.mocked(gsap.fromTo).mock.calls[0][0]).toHaveLength(2);

		action?.update?.({ key: 'a' });
		expect(gsap.fromTo).toHaveBeenCalledTimes(1);
		action?.update?.({ key: 'b' });
		expect(gsap.fromTo).toHaveBeenCalledTimes(2);
	});

	it('não anima nada com movimento reduzido', () => {
		reduceMotion(true);
		const node = document.createElement('div');
		node.append(document.createElement('span'));

		expect(prefersReducedMotion()).toBe(true);
		staggerIn(node, {});
		revealIn(node, {});
		pop(node);
		expect(gsap.fromTo).not.toHaveBeenCalled();
	});

	it('conta até o valor e escreve no texto', () => {
		const node = document.createElement('span');
		const action = countUp(node, 42);
		expect(node.textContent).toBe('42');
		action?.update?.(7);
		expect(node.textContent).toBe('7');
	});

	it('gira só enquanto ativo', () => {
		const node = document.createElement('span');
		const action = spinWhile(node, false);
		expect(gsap.to).not.toHaveBeenCalled();
		action?.update?.(true);
		expect(gsap.to).toHaveBeenCalledWith(node, expect.objectContaining({ repeat: -1 }));
	});

	it('ignora nó vazio no pop', () => {
		pop(null);
		expect(gsap.fromTo).not.toHaveBeenCalled();
	});
});
