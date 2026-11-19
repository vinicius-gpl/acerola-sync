import gsap from 'gsap';
import type { Action } from 'svelte/action';

/// Whoever asks the system for reduced motion sees no animation: everything jumps to the final state.
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

export type StaggerOptions = {
	/// Change the value to replay the entrance (e.g. switching tabs redoes the grid).
	key?: unknown;
	/// Selector of the animated items; default: direct children.
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

/// Cascading entrance of a grid/list's items. Plays on mount and whenever `key` changes.
export const staggerIn: Action<HTMLElement, StaggerOptions | undefined> = (node, options = {}) => {
	let current = options;
	// Waits for Svelte to render the children (the `{#each}` runs after the `use:`).
	requestAnimationFrame(() => playStagger(node, current));

	return {
		update(next = {}) {
			const changed = next.key !== current.key;
			current = next;
			if (changed) requestAnimationFrame(() => playStagger(node, current));
		}
	};
};

/// Entrance of a single block (screen, panel, highlight card). `skip` mounts without animating.
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

/// A number that "counts" up to the new value instead of switching abruptly.
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

/// Short confirmation "jump" (e.g. +1 saved).
export function pop(node: Element | null | undefined) {
	if (!node || prefersReducedMotion()) return;
	gsap.fromTo(node, { scale: 0.82 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
}

/// Spins while `active` is true (sync icon running).
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
