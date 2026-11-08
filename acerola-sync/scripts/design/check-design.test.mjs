import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkSource, isExempt } from './check-design.mjs';

const rules = (source) => checkSource(source).map((problem) => problem.rule);

test('recusa cor fora do token', () => {
	assert.deepEqual(rules(`<div style="color:#ff0000">`), ['hex-color']);
	assert.deepEqual(rules(`const c = 'rgb(0 0 0)';`), ['color-function']);
	assert.deepEqual(rules(`<p class="text-emerald-500">`), ['tailwind-palette']);
	assert.deepEqual(rules(`<p class="bg-black/50">`), ['tailwind-palette']);
	assert.deepEqual(rules(`<p class="text-white">`), ['tailwind-palette']);
	assert.deepEqual(rules(`<p class="bg-[#123456]">`), ['hex-color', 'arbitrary-color']);
});

test('aceita token do tema e sintaxe do Svelte', () => {
	assert.deepEqual(rules(`<p class="bg-primary-soft text-success bg-scrim/50 text-on-scrim">`), []);
	assert.deepEqual(rules(`{#each items as item}{#if a}{#key b}`), []);
	assert.deepEqual(rules(`location.hash = '#access_token'`), []);
});

test('recusa borda colorida', () => {
	assert.deepEqual(rules(`<div class="border-primary">`), ['colored-border']);
	assert.deepEqual(rules(`<div class="border-l-4">`), ['colored-border']);
	assert.deepEqual(rules(`border-left: 4px solid var(--x);`), ['colored-border']);
	assert.deepEqual(rules(`<div class="border-none">`), []);
});

test('só raio por token', () => {
	assert.deepEqual(rules(`<div class="rounded-3xl">`), ['radius']);
	assert.deepEqual(rules(`<div class="rounded-[28px]">`), ['radius']);
	assert.deepEqual(rules(`<div class="rounded-tl-xl">`), ['radius']);
	assert.deepEqual(rules(`<div class="rounded">`), ['radius']);
	assert.deepEqual(rules(`<div class="rounded-card rounded-full rounded-inner">`), []);
});

test('linha com design-allow passa', () => {
	assert.deepEqual(rules(`<div class="text-white"> <!-- design-allow: logo da marca -->`), []);
});

test('isenta tema, shadcn e testes', () => {
	assert.equal(isExempt('/x/extension/svelte/src/theme/colors/catppuccin.css'), true);
	assert.equal(isExempt('/x/extension/svelte/src/lib/components/ui/button/button.svelte'), true);
	assert.equal(isExempt('/x/extension/svelte/src/lib/screens/HomeScreen.test.ts'), true);
	assert.equal(isExempt('/x/extension/svelte/src/lib/screens/HomeScreen.svelte'), false);
});
