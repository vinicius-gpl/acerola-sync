import gsap from 'gsap';
import type { Action } from 'svelte/action';

/// Quem pede menos movimento no sistema não vê animação: tudo vai direto pro estado final.
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

export type StaggerOptions = {
	/// Muda o valor para tocar a entrada de novo (ex.: troca de aba refaz a grade).
	key?: unknown;
	/// Seletor dos itens animados; padrão: filhos diretos.
	selector?: string;
	stagger?: number;
};

function targets(node: HTMLElement, selector?: string): Element[] {
	return selector ? [...node.querySelectorAll(selector)] : [...node.children];
}

function playStagger(node: HTMLElement, options: StaggerOptions) {
	const items = targets(node, options.selector);
	if (!items.length || prefersReducedMotion()) return;
	gsap.fromTo(
		items,
		{ y: 18, opacity: 0, scale: 0.97 },
		{
			y: 0,
			opacity: 1,
			scale: 1,
			duration: 0.45,
			ease: 'power3.out',
			stagger: options.stagger ?? 0.035,
			clearProps: 'transform,opacity'
		}
	);
}

/// Entrada em cascata dos itens de uma grade/lista. Toca ao montar e sempre que `key` muda.
export const staggerIn: Action<HTMLElement, StaggerOptions | undefined> = (node, options = {}) => {
	let current = options;
	// Espera o Svelte renderizar os filhos (o `{#each}` roda depois do `use:`).
	requestAnimationFrame(() => playStagger(node, current));

	return {
		update(next = {}) {
			const changed = next.key !== current.key;
			current = next;
			if (changed) requestAnimationFrame(() => playStagger(node, current));
		}
	};
};

/// Entrada de um bloco só (tela, painel, card de destaque). `skip` monta sem animar.
export const revealIn: Action<
	HTMLElement,
	{ y?: number; delay?: number; skip?: boolean } | undefined
> = (node, options = {}) => {
	if (options.skip || prefersReducedMotion()) return;
	gsap.fromTo(
		node,
		{ y: options.y ?? 12, opacity: 0 },
		{
			y: 0,
			opacity: 1,
			duration: 0.5,
			delay: options.delay ?? 0,
			ease: 'power3.out',
			clearProps: 'transform,opacity'
		}
	);
};

/// Número que "conta" até o valor novo em vez de trocar seco.
export const countUp: Action<HTMLElement, number> = (node, value) => {
	const state = { value: 0 };
	let tween: gsap.core.Tween | undefined;

	function render(target: number) {
		tween?.kill();
		if (prefersReducedMotion()) {
			node.textContent = String(target);
			state.value = target;
			return;
		}
		tween = gsap.to(state, {
			value: target,
			duration: 0.8,
			ease: 'power2.out',
			onUpdate: () => {
				node.textContent = String(Math.round(state.value));
			}
		});
	}

	render(value);
	return {
		update: render,
		destroy: () => tween?.kill()
	};
};

/// "Pulo" curto de confirmação (ex.: +1 salvo).
export function pop(node: Element | null | undefined) {
	if (!node || prefersReducedMotion()) return;
	gsap.fromTo(node, { scale: 0.82 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
}

/// Gira enquanto `active` for verdadeiro (ícone de sync rodando).
export const spinWhile: Action<HTMLElement, boolean> = (node, active) => {
	let tween: gsap.core.Tween | undefined;

	function apply(on: boolean) {
		if (on && !tween && !prefersReducedMotion()) {
			tween = gsap.to(node, { rotation: 360, duration: 1, ease: 'none', repeat: -1 });
		} else if (!on && tween) {
			tween.kill();
			tween = undefined;
			gsap.to(node, { rotation: 0, duration: 0.3, ease: 'power2.out' });
		}
	}

	apply(active);
	return {
		update: apply,
		destroy: () => tween?.kill()
	};
};
