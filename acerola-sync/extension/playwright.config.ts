import { defineConfig } from '@playwright/test';

// A extensão é carregada já buildada (`npm run test:e2e` faz o build antes). Extensão MV3 só
// roda em Chromium com contexto persistente — ver `tests/e2e/fixtures.ts`.
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
