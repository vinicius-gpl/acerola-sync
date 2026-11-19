import gsap from 'gsap';
import type { Action } from 'svelte/action';
import { cn } from '$lib/utils/cn.utils';

type TrackedProp = 'x' | 'y' | 'width' | 'height';

export type SlidingIndicatorOptions = {
	/// Selector (relative to the container) of the currently active item, read through an
	/// attribute, not a reactive value (`aria-current="page"` in the sidebar, `data-state="on"` in
	/// the toggle group), so the action stays pure DOM and needs no `update()` tied to a rune.
	selector: string;
	/// Classes of the injected indicator element: controls the look (pill behind an icon, thin
	/// bar under a tab). Position/size properties the class already fixes via CSS (e.g.
	/// `bottom-0 h-1` on a bar) must be left out of `track` below.
	indicatorClass: string;
	duration?: number;
	/// Which properties of the active item's box to mirror on the indicator; the rest stays fixed
	/// by the CSS classes above. Default: all of them (the "pill" case covering the whole box).
	track?: TrackedProp[];
};

const DEFAULT_TRACK: TrackedProp[] = ['x', 'y', 'width', 'height'];
const DEFAULT_DURATION = 0.22;

/// Replaces an instant class swap (e.g. `bg-primary` jumping from item to item) with an
/// indicator that slides to the active item's position/size, reapplied whenever the attribute
/// marking "active" changes in the container (via `MutationObserver`, not a reactive prop).
export const slidingIndicator: Action<HTMLElement, SlidingIndicatorOptions> = (node, opts) => {
	node.classList.add('relative');

	const indicator = document.createElement('div');
	indicator.className = cn(
		'pointer-events-none absolute top-0 left-0 -z-10 opacity-0',
		opts.indicatorClass
	);
	node.prepend(indicator);

	const track = opts.track ?? DEFAULT_TRACK;
	let tween: gsap.core.Tween | undefined;

	function snap(animate: boolean) {
		const active = node.querySelector<HTMLElement>(opts.selector);
		tween?.kill();

		if (!active) {
			gsap.set(indicator, { opacity: 0 });
			return;
		}

		const containerRect = node.getBoundingClientRect();
		const rect = active.getBoundingClientRect();
		// `getBoundingClientRect` carries the surrounding scale: measured in the middle of a
		// dialog's entrance zoom (95%), the indicator kept the wrong size forever. Dividing by the
		// current scale gives back the layout size, the same as the `transform`.
		// Fractional layout width (`offsetWidth` rounds and created its own error).
		const style = getComputedStyle(node);
		const layoutWidth = parseFloat(style.width);
		const layoutHeight = parseFloat(style.height);
		const scaleX = layoutWidth > 0 ? containerRect.width / layoutWidth : 1;
		const scaleY = layoutHeight > 0 ? containerRect.height / layoutHeight : 1;
		// The indicator lives inside the container: in a scrolling container (chips that do not
		// fit), the position is the content's, so add how far it has scrolled.
		const full: Record<TrackedProp, number> = {
			x: (rect.left - containerRect.left) / (scaleX || 1) + node.scrollLeft,
			y: (rect.top - containerRect.top) / (scaleY || 1) + node.scrollTop,
			width: rect.width / (scaleX || 1),
			height: rect.height / (scaleY || 1)
		};

		// `autoRound: false`: GSAP rounds px to integers and the pill ended up to half a pixel
		// off the chip (cut straight by the strip's overflow).
		const target: Record<string, number | boolean> = { opacity: 1, autoRound: false };
		for (const key of track) target[key] = full[key];

		if (animate) {
			tween = gsap.to(indicator, {
				...target,
				duration: opts.duration ?? DEFAULT_DURATION,
				ease: 'power2.out'
			});
		} else {
			gsap.set(indicator, target);
		}
	}

	snap(false);
	// Tab/toggle libraries (bits-ui) resolve which item starts "active" through their own
	// internal reactivity, not a direct prop: there is no guarantee the attribute is already in
	// the DOM at the synchronous moment of this `use:`. A re-snap on the next frame covers that
	// window without waiting for a mutation that may never happen (the item is born active).
	requestAnimationFrame(() => snap(false));
	// Font metrics only settle after the first paint: without this, an item with text may
	// measure the wrong width until the layout fully settles.
	document.fonts?.ready?.then(() => snap(false));

	// Each item's size counts, not just the container's: switching Anime ↔ Manga changes the
	// active chip's text ("Watching" ↔ "Reading") without changing which one is active, and a
	// container with `max-w-full` does not even change width. Without this, the pill kept the old width.
	const resizeObserver =
		typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => snap(false));
	const observed = new Set<Element>();
	function observeItems() {
		if (!resizeObserver) return;
		for (const child of node.children) {
			if (child === indicator || observed.has(child)) continue;
			observed.add(child);
			resizeObserver.observe(child);
		}
		for (const child of observed) {
			if (child.parentElement !== node) {
				observed.delete(child);
				resizeObserver.unobserve(child);
			}
		}
	}
	resizeObserver?.observe(node);
	observeItems();

	const mutationObserver = new MutationObserver((mutations) => {
		// An item entering or leaving (e.g. the "Rewatching" tab only shows with a count) also
		// moves the others; text changing inside an item changes its width.
		if (mutations.some((mutation) => mutation.type === 'childList')) observeItems();
		snap(mutations.some((mutation) => mutation.type === 'attributes'));
	});
	mutationObserver.observe(node, {
		attributes: true,
		childList: true,
		characterData: true,
		subtree: true,
		attributeFilter: ['aria-current', 'aria-selected', 'data-state']
	});

	return {
		destroy() {
			mutationObserver.disconnect();
			resizeObserver?.disconnect();
			tween?.kill();
			indicator.remove();
		}
	};
};
