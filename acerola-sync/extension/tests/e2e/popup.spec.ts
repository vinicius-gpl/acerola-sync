import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page, BrowserContext } from '@playwright/test';
import { expect, test } from './fixtures';

const SERVER = 'https://sync.test';
const soon = (hours: number) => new Date(Date.now() + hours * 3600e3).toISOString();

function media(id: number, title: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		mediaType: 'ANIME',
		titleUserPreferred: title,
		coverUrl: null,
		coverColor: '#334455',
		episodes: 12,
		chapters: null,
		status: 'FINISHED',
		format: 'TV',
		seasonYear: 2024,
		nextAiringEpisode: null,
		nextAiringAt: null,
		genres: [],
		synonyms: [],
		...extra
	};
}

function entry(id: number, title: string, progress: number, extra: Record<string, unknown> = {}) {
	return {
		mediaId: id,
		status: 'CURRENT',
		progress,
		score: 0,
		dirty: false,
		media: media(id, title, extra)
	};
}

async function signIn(context: BrowserContext) {
	const [worker] = context.serviceWorkers();
	await worker.evaluate(
		([server]) =>
			chrome.storage.local.set({
				serverUrl: server,
				session: { token: 'tok', user: { id: 1, name: 'vinicius', avatarUrl: null, siteUrl: null } }
			}),
		[SERVER]
	);
}

/** Server falso: lista, contagens, +1 e um sync que termina na segunda consulta de logs. */
async function mockServer(page: Page, calls: { patched: unknown[]; synced: number }) {
	let logPolls = 0;
	await page.route(`${SERVER}/**`, async (route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();
		if (url.pathname === '/entries/counts') {
			return route.fulfill({
				json: [
					{ mediaType: 'ANIME', status: 'CURRENT', count: 2 },
					{ mediaType: 'ANIME', status: 'COMPLETED', count: 340 }
				]
			});
		}
		if (url.pathname === '/entries') {
			return route.fulfill({
				json: [
					entry(1, 'Sousou no Frieren', 3),
					entry(2, 'Dandadan', 4, {
						status: 'RELEASING',
						nextAiringEpisode: 7,
						nextAiringAt: soon(50)
					})
				]
			});
		}
		if (url.pathname === '/entries/2' && method === 'PATCH') {
			calls.patched.push(route.request().postDataJSON());
			return route.fulfill({
				json: {
					...entry(2, 'Dandadan', 5, { status: 'RELEASING', nextAiringEpisode: 7 }),
					pending: false
				}
			});
		}
		if (url.pathname === '/sync' && method === 'POST') {
			calls.synced++;
			return route.fulfill({ status: 202, json: run('RUNNING') });
		}
		if (url.pathname === '/sync/status') {
			return route.fulfill({
				json: {
					settings: {
						scheduleEnabled: true,
						scheduleTimes: ['12:00:00'],
						lastPullAt: null,
						lastFullSyncAt: null
					},
					runs: [],
					running: false,
					pendingEntries: 0
				}
			});
		}
		if (url.pathname === '/sync/runs/9/logs') {
			logPolls++;
			const logs = [
				{ id: logPolls, runId: 9, level: 'INFO', message: `linha ${logPolls}`, createdAt: soon(0) }
			];
			return route.fulfill({ json: { run: run(logPolls >= 2 ? 'SUCCESS' : 'RUNNING'), logs } });
		}
		if (url.pathname === '/history' || url.pathname === '/custom-sites')
			return route.fulfill({ json: [] });
		return route.fulfill({ status: 404, json: { errorType: 'not_found', message: url.pathname } });
	});
}

function run(status: string) {
	return {
		id: 9,
		trigger: 'MANUAL',
		status,
		mode: 'INCREMENTAL',
		startedAt: soon(0),
		finishedAt: status === 'RUNNING' ? null : soon(0),
		entriesPulled: 1,
		entriesPushed: 0,
		entriesRemoved: 0,
		anilistRequests: 1,
		error: null
	};
}

test('sem sessão, o popup abre na tela de login', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	await expect(
		page.getByRole('button', { name: /Entrar com o AniList|Log in with AniList/ })
	).toBeVisible();
	await expect(page.getByText(/chromiumapp\.org/)).toBeVisible();
});

test('lista por status, destaque e +1', async ({ context, page, extensionId }) => {
	await signIn(context);
	const calls = { patched: [] as unknown[], synced: 0 };
	await mockServer(page, calls);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	await expect(page.getByRole('tab', { name: /Completed|Completo/ })).toContainText('340');
	// O primeiro da lista vira o destaque "Continuar"; o +1 dele manda progress + 1.
	const spotlight = page.locator('[data-spotlight]');
	await expect(spotlight).toContainText('Sousou no Frieren');

	const card = page.locator('[data-media-card]', { hasText: 'Dandadan' });
	await card.hover();
	await card.getByRole('button', { name: /Somar 1|Add 1/ }).click();
	await expect.poll(() => calls.patched).toEqual([{ progress: 5 }]);
	await expect(card).toContainText('5/12');
});

test('sync mostra os logs ao vivo até terminar', async ({ context, page, extensionId }) => {
	await signIn(context);
	const calls = { patched: [] as unknown[], synced: 0 };
	await mockServer(page, calls);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	await page.getByRole('button', { name: 'Sync' }).click();
	await page.getByRole('button', { name: /Sincronizar agora|Sync now/ }).click();

	await expect(page.getByRole('log')).toContainText('linha 1');
	await expect(page.getByRole('log')).toContainText('linha 2');
	await expect(page.getByText(/Em dia|Up to date/)).toBeVisible();
	expect(calls.synced).toBe(1);
});

test('página cheia abre a obra num painel', async ({ context, page, extensionId }) => {
	await signIn(context);
	const calls = { patched: [] as unknown[], synced: 0 };
	await mockServer(page, calls);
	await page.route(`${SERVER}/media/1`, (route) =>
		route.fulfill({ json: { media: media(1, 'Sousou no Frieren'), entry: null } })
	);
	await page.goto(`chrome-extension://${extensionId}/app.html`);

	await page.getByRole('button', { name: 'Sousou no Frieren' }).first().click();
	await expect(page.getByRole('heading', { name: 'Sousou no Frieren', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: /Adicionar à lista|Add to list/ })).toBeVisible();
});

test('app.html?media= abre direto na obra, mesmo mangá com dados repetidos', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	const calls = { patched: [] as unknown[], synced: 0 };
	await mockServer(page, calls);
	// Mangá de formato MANGA, com relação repetida e link repetido: nada disso pode travar.
	const relation = {
		relationType: 'ADAPTATION',
		id: 9,
		mediaType: 'ANIME',
		format: 'TV',
		status: 'FINISHED',
		title: 'Chainsaw Man (anime)',
		coverUrl: null
	};
	await page.route(`${SERVER}/media/1`, (route) =>
		route.fulfill({
			json: {
				media: media(1, 'Chainsaw Man', {
					mediaType: 'MANGA',
					format: 'MANGA',
					chapters: 232,
					relations: [relation, relation],
					externalLinks: [
						{ site: 'Twitter', url: 'https://x.com/csm', kind: 'SOCIAL', language: null },
						{ site: 'Twitter', url: 'https://x.com/csm', kind: 'SOCIAL', language: null }
					]
				}),
				entry: null,
				visits: []
			}
		})
	);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(`chrome-extension://${extensionId}/app.html?media=1`);

	await expect(page.getByRole('heading', { name: 'Chainsaw Man', level: 1 })).toBeVisible();
	await expect(page.getByText(/Relacionadas|Related/)).toBeVisible();
	expect(errors).toEqual([]);
});

test('id da extensão sai da chave do manifest (o login do AniList depende dele)', async ({
	extensionId
}) => {
	const manifest = JSON.parse(
		readFileSync(path.resolve('.output/chrome-mv3/manifest.json'), 'utf8')
	) as { key?: string };
	test.skip(!manifest.key, 'build sem EXTENSION_PUBLIC_KEY: o id depende da pasta');
	const hash = createHash('sha256').update(Buffer.from(manifest.key!, 'base64')).digest('hex');
	const expected = [...hash.slice(0, 32)].map((d) => 'abcdefghijklmnop'[parseInt(d, 16)]).join('');
	expect(extensionId).toBe(expected);
});
