import { mangadex } from '$lib/tracking/sites/mangadex';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
	matches: ['*://mangadex.org/*', '*://*.mangadex.org/*'],
	main() {
		startTracking(mangadex);
	}
});
