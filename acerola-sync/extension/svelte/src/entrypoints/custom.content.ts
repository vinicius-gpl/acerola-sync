import { sendMessage } from '$lib/messaging';
import { createCustomAdapter } from '$lib/tracking/sites/custom';
import { startTracking } from '$lib/tracking/runner';
import { defineContentScript } from 'wxt/utils/define-content-script';

/**
 * Script genérico dos sites personalizados. Não entra no manifest: o background registra em
 * tempo de execução nos domínios que o usuário cadastrou e liberou.
 */
export default defineContentScript({
	registration: 'runtime',
	matches: [],
	async main() {
		const sites = await sendMessage({ type: 'custom-sites:for-url', url: location.href });
		for (const site of sites ?? []) startTracking(createCustomAdapter(site));
	}
});
