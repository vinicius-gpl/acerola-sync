/** `chrome.storage.local` keys (through WXT storage): the equivalent of acerola-reader's `store-plugin.ts`. */
export const STORAGE_KEYS = {
	mode: 'local:mode',
	/** Server address (e.g. `https://sync.acerola.app`). */
	serverUrl: 'local:serverUrl',
	/** Server session token + profile. Never goes to `storage.sync`. */
	session: 'local:session',
	/** Last screen opened, to reopen where it left off. */
	lastPage: 'local:lastPage',
	/** Built-in sites the user turned off. */
	disabledSites: 'local:disabledSites',
	/** Seconds on a chapter page before marking it as read. */
	mangaDelaySeconds: 'local:mangaDelaySeconds',
	/** Copy of the server's custom sites, so the background can register the scripts. */
	customSites: 'local:customSites',
	/** Media the on-site notice asked to open in the popup (`{ mediaId, at }`); valid for 30s. */
	pendingMedia: 'local:pendingMedia',
	/** Custom site draft carried from the popup to advanced mode on the full page. */
	pendingSiteDraft: 'local:pendingSiteDraft',
	/** Last episode already seen per anime (`{ [mediaId]: episode }`), to notify only new ones. */
	airingSeen: 'local:airingSeen',
	/** Latest new-episode notices (`NotificationItem[]`), for the notifications screen. */
	notifications: 'local:notifications',
	/** Where the floating button sits on each site (`{ [host]: FabPosition }`); same on both PCs. */
	fabPositions: 'sync:fabPositions'
} as const;
