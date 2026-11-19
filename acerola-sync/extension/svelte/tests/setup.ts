import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';

// Mock to work around jsdom and radix/bits-ui pointer events issues
if (typeof window !== 'undefined') {
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
	// jsdom already exposes `Element.prototype.animate` (it is not `undefined`), but it returns
	// something incomplete, so the obvious guard `if (!Element.prototype.animate)` never catches
	// this case (it cannot be used here). A plain function, NOT `vi.fn()`, for the same reason as
	// `matchMedia` below: `vi.resetAllMocks()` in the `beforeEach` of several files would wipe a
	// spy's implementation. `@formkit/auto-animate` treats the return as a real `Animation`
	// (which extends `EventTarget`) and registers `finish` listeners on it: without this, it
	// breaks asynchronously (outside the test body) as soon as a list with `use:autoAnimate`
	// gains/loses an item.
	Element.prototype.animate = function animate() {
		return {
			finished: Promise.resolve(),
			cancel: vi.fn(),
			finish: vi.fn(),
			pause: vi.fn(),
			play: vi.fn(),
			reverse: vi.fn(),
			onfinish: null,
			oncancel: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		} as unknown as Animation;
	};
	// @ts-ignore: Simple mock for tests that resolves hasPointerCapture
	window.PointerEvent = class PointerEvent extends Event {};

	// jsdom does not implement ResizeObserver/IntersectionObserver, used by actions like
	// `slidingIndicator` and `AcerolaSectionNav` (scroll-spy). Guarded with `if (!X)` (unlike
	// `animate` above, these two really do not exist in jsdom by default), so as not to step on
	// stubs a specific test already registers to drive the callbacks by hand (e.g.
	// `comic-page.test.ts`).
	if (!window.ResizeObserver) {
		window.ResizeObserver = class ResizeObserver {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		};
	}
	if (!window.IntersectionObserver) {
		// @ts-ignore: minimal stub, enough for code that only calls observe/disconnect
		window.IntersectionObserver = class IntersectionObserver {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		};
	}

	// Mock localStorage
	Object.defineProperty(window, 'localStorage', {
		value: {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		},
		writable: true
	});

	// matchMedia mock: a plain function, NOT `vi.fn()`: several test files call
	// `vi.resetAllMocks()` in their own `beforeEach`, which would wipe a spy's implementation
	// and return `undefined` from `window.matchMedia(...)` for the rest of that file, breaking
	// any code that reads `.matches` on the result (e.g. `@formkit/auto-animate` checking
	// `prefers-reduced-motion` on mount). No test asserts on this global mock today
	// (`is-mobile.test.ts` registers its own, isolated, when it needs to spy on calls).
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // Deprecated
			removeListener: vi.fn(), // Deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		})
	});
}

// WXT storage mock: jsdom has no `chrome.storage`. Default behavior: returns null (no saved
// value), like the Tauri store mock in acerola-reader.
vi.mock('wxt/utils/storage', () => ({
	storage: {
		getItem: vi.fn().mockResolvedValue(null),
		setItem: vi.fn().mockResolvedValue(undefined)
	}
}));

afterEach(async () => {
	cleanup();
	await new Promise((resolve) => setTimeout(resolve, 30));
	vi.clearAllMocks();
});
