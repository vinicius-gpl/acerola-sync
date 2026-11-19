import gsap from 'gsap';
import type { Action } from 'svelte/action';
import { cn } from '$lib/utils/cn.utils';

export type ToastIconVariant = 'loading' | 'success' | 'error' | 'warning' | 'info';

const BURST_COLOR: Partial<Record<ToastIconVariant, string>> = {
	success: 'bg-success/35',
	error: 'bg-destructive/30',
	warning: 'bg-warning/30'
};

// Creates and animates a ring that expands and fades behind the icon: gives weight to the
// result (success/error) without relying only on the glyph swap. Removes itself when done.
function spawnBurst(node: HTMLElement, colorClass: string) {
	const ring = document.createElement('span');
	ring.className = cn('pointer-events-none absolute inset-0 rounded-full', colorClass);
	node.prepend(ring);
	gsap.fromTo(
		ring,
		{ scale: 0.3, opacity: 0.6 },
		{
			scale: 2.4,
			opacity: 0,
			duration: 0.55,
			ease: 'power2.out',
			onComplete: () => ring.remove()
		}
	);
}

/// Animates the entrance of a toast icon (`svelte-sonner`) whenever `type` changes:
/// `loading` -> `success`/`error`/etc mounts a new DOM element (see the lib's `Toast.svelte`),
/// so this `use:` action runs once per state change, giving a "morph" feel even though
/// different icons occupy the same slot.
export const toastIconEnter: Action<HTMLElement, ToastIconVariant> = (node, variant) => {
	node.classList.add('relative', 'inline-flex', 'items-center', 'justify-center');

	const ctx = gsap.context(() => {
		switch (variant) {
			case 'success':
				spawnBurst(node, BURST_COLOR.success!);
				gsap.fromTo(
					node,
					{ scale: 0.4, opacity: 0, rotate: -90 },
					{ scale: 1, opacity: 1, rotate: 0, duration: 0.4, ease: 'back.out(2.2)' }
				);
				break;
			case 'error':
				spawnBurst(node, BURST_COLOR.error!);
				gsap.fromTo(
					node,
					{ scale: 0.5, opacity: 0 },
					{
						scale: 1,
						opacity: 1,
						duration: 0.3,
						ease: 'power2.out',
						onComplete: () => {
							gsap.fromTo(
								node,
								{ x: -4 },
								{ x: 0, duration: 0.35, ease: 'elastic.out(1.4, 0.35)' }
							);
						}
					}
				);
				break;
			case 'warning':
			case 'info':
				gsap.fromTo(
					node,
					{ y: -6, opacity: 0 },
					{ y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' }
				);
				break;
			default:
				gsap.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.2 });
		}
	}, node);

	return {
		destroy() {
			ctx.revert();
		}
	};
};
