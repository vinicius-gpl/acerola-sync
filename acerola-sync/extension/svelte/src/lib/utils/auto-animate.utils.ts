import autoAnimate from '@formkit/auto-animate';
import type { AutoAnimateOptions, AutoAnimationPlugin } from '@formkit/auto-animate';
import type { Action } from 'svelte/action';

/// `autoAnimate()` returns an `AnimationController` (with `enable`/`disable`/`isEnabled`), not
/// the `{destroy}` Svelte's action contract expects: this wrapper closes that gap and stops
/// observing the list when the node is destroyed.
export const autoAnimateList: Action<
	HTMLElement,
	Partial<AutoAnimateOptions> | AutoAnimationPlugin | undefined
> = (node, options) => {
	const controller = autoAnimate(node, options);

	return {
		destroy() {
			controller.disable();
		}
	};
};
