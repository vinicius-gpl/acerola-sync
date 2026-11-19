import { defineConfig } from '@playwright/test';

// The extension is loaded already built (`npm run test:e2e` builds first). An MV3 extension only
// runs in Chromium with a persistent context; see `tests/e2e/fixtures.ts`.
export default defineConfig({
	testDir: './tests/e2e',
	timeout: 10_000,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	expect: {
		timeout: 5_000
	},
	use: {
		trace: 'retain-on-failure'
	}
});
