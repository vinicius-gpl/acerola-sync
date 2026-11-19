export const CONTEXT_KEYS = {
	activeComic: Symbol('active-comic'),
	/// Shares the SAME `useNetworkSync()` instance between `+layout.svelte` (never unmounts)
	/// and `routes/network/+page.svelte`: without it, each had its own instance with its own
	/// listeners, and `syncComic()` (which only resolves through a listener of the instance
	/// that called it) became a forcibly cancelled promise whenever the user navigated to
	/// another screen with a sync still running, even though the real sync kept going (and
	/// finished fine) in the backend.
	networkSync: Symbol('network-sync')
} as const;
