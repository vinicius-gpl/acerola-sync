import { sendMessage } from '$lib/messaging';
import { createCustomAdapter } from '$lib/tracking/sites/custom';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

/**
 * Generic script for custom sites. It is not in the manifest: the background registers it at
 * runtime on the domains the user added and granted.
 */
export default defineContentScript({
	registration: 'runtime',
	matches: [],
	async main() {
		const sites = await sendMessage({ type: 'custom-sites:for-url', url: location.href });
		for (const site of sites ?? []) startTracking(createCustomAdapter(site));
	}
});
