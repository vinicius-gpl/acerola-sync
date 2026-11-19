import { toast } from 'svelte-sonner';

type ToastAsyncMessages<T> = {
	loading: string;
	success: string | ((result: T) => string);
	error: string | ((err: unknown) => string);
	/// Minimum time (ms) the toast stays in the "loading" state before turning into success/error:
	/// without it, a near-instant local operation jumps straight to the final result and the
	/// icon transition animation (loading -> check) is never noticed.
	minDurationMs?: number;
};

const DEFAULT_MIN_DURATION_MS = 450;

function waitRemaining(startedAt: number, minDurationMs: number): Promise<void> {
	const remaining = minDurationMs - (performance.now() - startedAt);
	if (remaining <= 0) return Promise.resolve();
	return new Promise((resolve) => setTimeout(resolve, remaining));
}

/// Fires a loading toast, runs `action`, and updates the SAME toast (same `id`) to success or
/// error when it ends: svelte-sonner swaps the icon in place in that case (see `toastIconEnter`
/// in `toast-icon-motion.utils.ts`), instead of stacking a second independent toast as
/// `toast.info(...)` followed by `toast.success(...)` used to.
export async function toastAsync<T>(
	action: () => Promise<T>,
	messages: ToastAsyncMessages<T>
): Promise<T> {
	const { loading, success, error, minDurationMs = DEFAULT_MIN_DURATION_MS } = messages;
	const id = toast.loading(loading);
	const startedAt = performance.now();

	try {
		const result = await action();
		await waitRemaining(startedAt, minDurationMs);
		toast.success(typeof success === 'function' ? success(result) : success, { id });
		return result;
	} catch (err) {
		await waitRemaining(startedAt, minDurationMs);
		toast.error(typeof error === 'function' ? error(err) : error, { id });
		throw err;
	}
}
