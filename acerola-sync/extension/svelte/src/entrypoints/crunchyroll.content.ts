import { crunchyroll } from '$lib/tracking/sites/crunchyroll';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
	matches: ['*://*.crunchyroll.com/*'],
	main() {
		startTracking(crunchyroll);
	}
});
