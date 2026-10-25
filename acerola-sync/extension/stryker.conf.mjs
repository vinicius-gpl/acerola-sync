// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: 'npm',
	testRunner: 'vitest',
	vitest: {
		configFile: 'vitest.stryker.config.ts'
	},
	coverageAnalysis: 'perTest',
	buildCommand: 'npm run paraglide:compile',
	ignorePatterns: [
		'svelte/src/lib/paraglide',
		'coverage',
		'test-results',
		'playwright-report',
		'storybook-static',
		'mutants.out',
		'mutants.out.old'
	],
	mutate: [
		'svelte/src/lib/hooks/**/*.svelte.ts',
		'svelte/src/lib/state/**/*.svelte.ts',
		'svelte/src/lib/services/**/*.ts',
		'svelte/src/lib/utils/**/*.ts',
		'!svelte/src/**/*.test.ts',
		'!svelte/src/**/*.browser.test.ts',
		'!svelte/src/**/*.stories.svelte',
		'!svelte/src/lib/paraglide/**',
		'!svelte/src/lib/components/ui/**'
	],
	reporters: ['html', 'clear-text', 'progress'],
	htmlReporter: {
		fileName: 'mutants.out/mutation-report.html'
	},
	thresholds: {
		// Mesmos limites do acerola-reader.
		high: 70,
		low: 50,
		break: 45
	}
};
