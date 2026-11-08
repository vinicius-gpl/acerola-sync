import { netflix } from '$lib/tracking/sites/netflix';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
	matches: ['*://*.netflix.com/*'],
	main() {
		startTracking(netflix);
	}
});
