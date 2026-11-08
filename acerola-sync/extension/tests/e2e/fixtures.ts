import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
	// eslint-disable-next-line no-empty-pattern
	context: async ({}, use) => {
		const context = await chromium.launchPersistentContext('', {
			channel: 'chromium',
			args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
		});
		await use(context);
		await context.close();
	},
	extensionId: async ({ context }, use) => {
		let [serviceWorker] = context.serviceWorkers();
		if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');

		await use(serviceWorker.url().split('/')[2]);
	}
});

export const expect = test.expect;
