import { sakuraMangas } from '$lib/tracking/sites/sakuramangas';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
	matches: ['*://*.sakuramangas.org/*', '*://sakuramangas.org/*'],
	main() {
		startTracking(sakuraMangas);
	}
});
