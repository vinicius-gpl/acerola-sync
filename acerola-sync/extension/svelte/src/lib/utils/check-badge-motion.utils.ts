import gsap from 'gsap';
import type { Action } from 'svelte/action';

/// Animates the entrance of the relay cards' check badge (and any other "active badge")
/// whenever it mounts: since it lives inside an `{#if}`, each time the source turns on the node
/// is recreated from scratch, so the animation plays again on every toggle without `{#key}`.
/// Same one-shot gsap action pattern (no `destroy`) as `toastIconEnter`.
export const checkBadgePop: Action<HTMLElement> = (node) => {
	gsap.fromTo(
		node,
		{ scale: 0, opacity: 0 },
		{ scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)' }
	);
};
