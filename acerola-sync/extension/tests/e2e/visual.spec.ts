import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Real layout tests (headless Chromium): the unit tests' jsdom measures nothing, so a
// misaligned indicator, clipped text and layout jumps only show up here. Each state also
// becomes a screenshot in `test-results/visual/` for review.

const SERVER = 'https://sync.test';
const SHOTS = 'test-results/visual';

function media(id: number, title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME') {
	return {
		id,
		mediaType,
		titleUserPreferred: title,
		coverUrl: null,
		coverColor: '#334455',
		episodes: mediaType === 'ANIME' ? 12 : null,
		chapters: mediaType === 'MANGA' ? 232 : null,
		status: 'FINISHED',
		format: mediaType === 'ANIME' ? 'TV' : 'MANGA',
		seasonYear: 2024,
		nextAiringEpisode: null,
		nextAiringAt: null,
		genres: ['Drama'],
		synonyms: [],
		studios: [],
		externalLinks: [
			{
				site: 'Crunchyroll',
				url: 'https://www.crunchyroll.com/x',
				kind: 'STREAMING',
				language: null
			}
		],
		relations: []
	};
}

function entry(id: number, title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME') {
	return {
		mediaId: id,
		status: 'CURRENT',
		progress: 3,
		score: 0,
		dirty: false,
		media: media(id, title, mediaType)
	};
}

async function signIn(context: BrowserContext) {
	const [worker] = context.serviceWorkers();
	await worker.evaluate(
		([server]) =>
			chrome.storage.local.set({
				serverUrl: server,
				session: {
					token: 'tok',
					user: { id: 1, name: 'vinicius', avatarUrl: null, siteUrl: null }
				}
			}),
		[SERVER]
	);
}

/** On the page or the whole context (new tabs, like the full page opened by the popup). */
async function mockServer(page: Pick<Page, 'route'> | BrowserContext) {
	await page.route(`${SERVER}/**`, async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === '/entries/counts') {
			// Anime has "Rewatching" (one extra tab); manga does not: the strip changes size on switch.
			return route.fulfill({
				json: [
					{ mediaType: 'ANIME', status: 'CURRENT', count: 5 },
					{ mediaType: 'ANIME', status: 'COMPLETED', count: 475 },
					{ mediaType: 'ANIME', status: 'PLANNING', count: 55 },
					{ mediaType: 'ANIME', status: 'PAUSED', count: 3 },
					{ mediaType: 'ANIME', status: 'DROPPED', count: 12 },
					{ mediaType: 'ANIME', status: 'REPEATING', count: 1 },
					{ mediaType: 'MANGA', status: 'CURRENT', count: 18 },
					{ mediaType: 'MANGA', status: 'COMPLETED', count: 120 }
				]
			});
		}
		if (url.pathname === '/entries/facets')
			return route.fulfill({ json: { genres: ['Drama'], formats: ['TV'], years: [2024] } });
		if (url.pathname === '/entries') {
			const manga = url.searchParams.get('mediaType') === 'MANGA';
			return route.fulfill({
				json: manga
					? [entry(20, 'Chainsaw Man', 'MANGA'), entry(21, 'Dandadan', 'MANGA')]
					: [entry(1, 'Sousou no Frieren'), entry(2, 'Kusuriya no Hitorigoto')]
			});
		}
		if (url.pathname === '/media/1')
			return route.fulfill({
				json: { media: media(1, 'Sousou no Frieren'), entry: entry(1, ''), visits: [] }
			});
		if (url.pathname === '/sync/status')
			return route.fulfill({
				json: {
					settings: {
						scheduleEnabled: false,
						scheduleTimes: [],
						lastPullAt: null,
						lastFullSyncAt: null
					},
					runs: [],
					running: false,
					pendingEntries: 0
				}
			});
		if (url.pathname === '/history' || url.pathname === '/custom-sites')
			return route.fulfill({ json: [] });
		return route.fulfill({
			status: 404,
			json: { errorType: 'not_found', message: url.pathname }
		});
	});
}

type Box = { x: number; y: number; width: number; height: number };

/** Box of the sliding indicator and of the active item, already at the end of the animation. */
async function indicatorAndActive(container: Locator) {
	return container.evaluate((node) => {
		const box = (el: Element | null): Box | null => {
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		};
		const indicator = [...node.children].find((child) =>
			child.classList.contains('pointer-events-none')
		);
		const active = node.querySelector('[aria-selected="true"], [aria-current="page"]');
		return { indicator: box(indicator ?? null), active: box(active) };
	});
}

/** The pill covers the active chip (or the bar sits under it, if `underline`). */
async function expectAligned(container: Locator, underline = false) {
	await expect
		.poll(
			async () => {
				const { indicator, active } = await indicatorAndActive(container);
				if (!indicator || !active) return 'faltando indicador ou item ativo';
				const off = Math.max(
					Math.abs(indicator.x - active.x),
					Math.abs(indicator.width - active.width),
					underline ? 0 : Math.abs(indicator.y - active.y),
					underline ? 0 : Math.abs(indicator.height - active.height)
				);
				if (off > 0.25) return `desalinhado ${off.toFixed(2)}px`;
				// The pill must not overflow the strip (there it is cut straight by the overflow).
				const box = (await container.boundingBox())!;
				const outside = Math.max(
					box.x - indicator.x,
					indicator.x + indicator.width - (box.x + box.width)
				);
				return underline || outside <= 0.05
					? 'ok'
					: `pílula cortada ${outside.toFixed(2)}px`;
			},
			{ timeout: 3000 }
		)
		.toBe('ok');
}

// Same size as the popup (`w-[440px] h-[600px]`).
test.use({ viewport: { width: 440, height: 600 } });

test('fichas e Anime/Mangá acompanham a troca de tipo, a rolagem e o texto', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	await mockServer(page);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	const types = page.getByRole('tablist', { name: /Tipo|Type/ });
	const statuses = page.getByRole('tablist', { name: /^Status$/ });
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await expectAligned(statuses);
	await expectAligned(types, true);
	await page.screenshot({ path: `${SHOTS}/01-anime.png` });

	// Anime → Manga: "Watching" becomes "Reading" on the same active chip and one tab goes away.
	await types.getByRole('tab', { name: /Mang/ }).click();
	await expect(page.getByText('Chainsaw Man').first()).toBeVisible();
	await expectAligned(statuses);
	await expectAligned(types, true);
	await page.screenshot({ path: `${SHOTS}/02-manga.png` });

	await types.getByRole('tab', { name: /Anime/ }).click();
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await expectAligned(statuses);
	await expectAligned(types, true);

	// Last chip (outside the visible area): scrolls to it and the pill follows.
	const last = statuses.getByRole('tab').last();
	await last.click();
	await expectAligned(statuses);
	await page.screenshot({ path: `${SHOTS}/03-ultima-ficha.png` });
	await expect(statuses).toHaveAttribute('data-fade', /start|both/);

	// Nothing of the strip may stick out of the frame.
	const frame = await statuses.locator('xpath=..').boundingBox();
	const list = await statuses.boundingBox();
	expect(list!.x).toBeGreaterThanOrEqual(frame!.x);
	expect(list!.x + list!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 0.5);
});

test('troca de tipo não faz o cabeçalho pular', async ({ context, page, extensionId }) => {
	await signIn(context);
	await mockServer(page);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();

	const statuses = page.getByRole('tablist', { name: /^Status$/ });
	const search = page.getByRole('searchbox');
	const layout = async () => ({
		tabs: (await statuses.boundingBox())!,
		search: (await search.boundingBox())!
	});
	// Waits for the screen entrance (GSAP) to settle before measuring.
	await expect
		.poll(async () => {
			const first = await layout();
			await page.waitForTimeout(120);
			return Math.abs((await layout()).tabs.y - first.tabs.y);
		})
		.toBe(0);
	const before = await layout();

	await page.getByRole('tab', { name: /Mang/ }).click();
	// Measures during the switch (before, during and after the list arrives): nothing may jump.
	for (const wait of [0, 60, 200, 500]) {
		await page.waitForTimeout(wait);
		const now = await layout();
		expect(Math.abs(now.tabs.y - before.tabs.y), `abas em ${wait}ms`).toBeLessThanOrEqual(1);
		expect(Math.abs(now.search.y - before.search.y), `busca em ${wait}ms`).toBeLessThanOrEqual(
			1
		);
		expect(now.tabs.height).toBeCloseTo(before.tabs.height, 0);
	}
	await expect(page.getByText('Chainsaw Man').first()).toBeVisible();
});

test('barra de baixo e fichas da obra alinhadas; diálogo no padrão', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	await mockServer(page);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();

	const nav = page.getByRole('navigation').last();
	await expectAligned(nav);
	await nav.getByRole('button').nth(1).click();
	await expectAligned(nav);
	await nav.getByRole('button').first().click();
	await expectAligned(nav);

	// List scrolled before opening the media: the media must open at the top, with the actions in view.
	await page.locator('[data-scroller]').evaluate((node) => (node.scrollTop = 400));
	await page.getByRole('button', { name: 'Sousou no Frieren' }).first().click();
	await expect(page.getByRole('heading', { level: 1, name: 'Sousou no Frieren' })).toBeVisible();
	await expect(page.locator('[data-scroller]')).toHaveJSProperty('scrollTop', 0);
	await expect(page.locator('[data-sync-entry]')).toBeInViewport();
	const mediaStatuses = page.getByRole('tablist', { name: /^Status$/ });
	await expectAligned(mediaStatuses);
	await mediaStatuses.getByRole('tab').nth(2).click();
	await expectAligned(mediaStatuses);
	await page.screenshot({ path: `${SHOTS}/04-obra.png`, fullPage: true });
	const watch = page.locator('[data-watch-links] a').first();
	await watch.scrollIntoViewIfNeeded();
	await watch.screenshot({ path: `${SHOTS}/04b-onde-assistir.png` });

	await page.getByRole('button', { name: /Remover da lista|Remove from list/ }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	const border = await dialog.evaluate((node) => getComputedStyle(node).borderTopWidth);
	expect(border).toBe('0px');
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${SHOTS}/05-dialogo.png` });
});

test('seletor de horário: cartão dentro do popup, hora escolhida no meio da coluna', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	await mockServer(page);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await page.getByRole('navigation').last().getByRole('button').nth(2).click();

	const trigger = page.locator('[data-time-picker]');
	await trigger.scrollIntoViewIfNeeded();
	await trigger.click();
	const hours = page.getByRole('listbox', { name: /Hora|Hour/ });
	await expect(hours).toBeVisible();
	await page.waitForTimeout(300);

	// The whole card fits in the popup.
	const panel = (await hours.locator('xpath=../../..').boundingBox())!;
	expect(panel.x).toBeGreaterThanOrEqual(0);
	expect(panel.x + panel.width).toBeLessThanOrEqual(440);
	expect(panel.y).toBeGreaterThanOrEqual(0);
	expect(panel.y + panel.height).toBeLessThanOrEqual(600);

	// The selected hour is visible inside the column (it scrolled to it).
	const column = (await hours.boundingBox())!;
	const selected = (await hours.locator('[aria-selected="true"]').boundingBox())!;
	expect(selected.y).toBeGreaterThanOrEqual(column.y);
	expect(selected.y + selected.height).toBeLessThanOrEqual(column.y + column.height);
	await page.screenshot({ path: `${SHOTS}/06-horario.png` });

	await hours.getByRole('option', { name: '21' }).click();
	await page
		.getByRole('listbox', { name: /Minuto|Minute/ })
		.getByRole('option', { name: '30' })
		.click();
	await expect(trigger).toHaveText(/21:30/);
});

test('fichas dentro do formulário de site cabem inteiras, sem corte nem fade', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	// In Portuguese ("Mangá", longer names) is where it broke.
	await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'pt-br'));
	await mockServer(page);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await page.getByRole('navigation').last().getByRole('button').last().click();
	await page.getByRole('button', { name: /^(Adicionar|Add)$/ }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByPlaceholder(/Nome|Name/).fill('AnimeFire');
	await expect(dialog).toBeVisible();
	const types = dialog.getByRole('tablist').first();
	await types.getByRole('tab', { name: /Anime/ }).click();
	await expectAligned(types);
	const overflow = await types.evaluate((node) => node.scrollWidth - node.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
	await expect(types).toHaveAttribute('data-fade', 'none');
	await page.waitForTimeout(300);
	await dialog.screenshot({ path: `${SHOTS}/07-form-site.png` });
	await types.locator('xpath=..').screenshot({ path: `${SHOTS}/07b-fichas-form.png` });
	// The active pill stays fully inside the frame, with the border slack on both sides.
	const frame = (await types.locator('xpath=..').boundingBox())!;
	const pill = (await types.getByRole('tab', { selected: true }).boundingBox())!;
	expect(pill.x + pill.width).toBeLessThanOrEqual(frame.x + frame.width - 3);
	expect(pill.x).toBeGreaterThanOrEqual(frame.x + 3);
	// The pill (indicator) must not overflow the scrolling strip: there it is cut straight.
	const clip = await types.evaluate((node) => {
		const list = node.getBoundingClientRect();
		const pill = [...node.children]
			.find((child) => child.classList.contains('pointer-events-none'))!
			.getBoundingClientRect();
		return { left: pill.left - list.left, right: list.right - pill.right };
	});
	expect(clip.left).toBeGreaterThanOrEqual(0);
	expect(clip.right).toBeGreaterThanOrEqual(0);
	// And the pill has the chip's size (measured after the dialog's entrance zoom).
	const fit = await types.evaluate((node) => {
		const pill = [...node.children]
			.find((child) => child.classList.contains('pointer-events-none'))!
			.getBoundingClientRect();
		const tab = node.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
		return Math.max(Math.abs(pill.left - tab.left), Math.abs(pill.right - tab.right));
	});
	expect(fit).toBeLessThanOrEqual(0.1);
});

test('modo avançado do site: popup leva para a página cheia e o diálogo cresce em 2 colunas', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'pt-br'));
	await mockServer(context);
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await page.getByRole('navigation').last().getByRole('button').last().click();
	await page.getByRole('button', { name: /^(Adicionar|Add)$/ }).click();
	await page
		.getByRole('dialog')
		.getByPlaceholder(/Nome|Name/)
		.fill('Kuro');

	const opened = context.waitForEvent('page');
	await page.getByRole('button', { name: /Modo avançado|Advanced mode/ }).click();
	const full = await opened;
	expect(full.url()).toContain('/app.html?site=new');
	await full.setViewportSize({ width: 1440, height: 900 });

	const dialog = full.getByRole('dialog');
	await expect(dialog.locator('[data-advanced]')).toBeVisible();
	// The draft came along from the popup.
	await expect(dialog.getByPlaceholder(/Nome|Name/)).toHaveValue('Kuro');
	await dialog.getByRole('tab', { name: /Título da página|Page title/ }).click();
	await full.waitForTimeout(400);

	const box = (await dialog.boundingBox())!;
	expect(box.width).toBeGreaterThan(800);
	const overflow = await dialog.evaluate((node) => node.scrollWidth - node.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
	// Form on the left, number on the right, side by side.
	const form = (await dialog.getByPlaceholder(/Nome|Name/).boundingBox())!;
	const advanced = (await dialog.locator('[data-advanced]').boundingBox())!;
	expect(advanced.x).toBeGreaterThan(form.x + form.width);
	expect(Math.abs(advanced.y - form.y)).toBeLessThan(40);
	await expectAligned(dialog.locator('[data-advanced]').getByRole('tablist'));
	await dialog.screenshot({ path: `${SHOTS}/08-site-avancado.png` });

	// Test on a real open tab: a chapter with the number only in the page title. The domain is
	// one already allowed in the manifest, so the permission does not prompt.
	await context.route('https://sakuramangas.org/**', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<title>Cap. 30 — O Santuário - Kuro</title><h1>Masmorra da Torre</h1>'
		})
	);
	const chapter = await context.newPage();
	await chapter.goto('https://sakuramangas.org/read/2507/463111');
	await full.bringToFront();
	await dialog
		.getByPlaceholder('https://leitor.exemplo.com/*')
		.fill('https://sakuramangas.org/*');
	await dialog.getByPlaceholder(/\/read\//).fill('/read/(?<id>\\d+)/\\d+');

	// Source in the URL: does not find the number, but suggests the page title.
	await dialog.getByRole('tab', { name: /^URL$/ }).click();
	await dialog.getByRole('button', { name: /Testar numa aba|Test on an open tab/ }).click();
	const suggestion = dialog.locator('[data-suggestion]');
	await expect(suggestion).toContainText('Cap. 30');
	await suggestion.getByRole('button').click();
	await expect(dialog.locator('[data-test-result]')).toContainText(
		/Obra: 2507 · número: 30|Media: 2507 · number: 30/
	);
	await expect(
		dialog.getByRole('tab', { selected: true, name: /Título da página/ })
	).toBeVisible();
	await expectAligned(dialog.locator('[data-advanced]').getByRole('tablist'));
	await full.waitForTimeout(400);
	await dialog.screenshot({ path: `${SHOTS}/08b-site-avancado-teste.png` });
});

test('tela de erro: server fora do ar no popup cabe inteira e tentar de novo volta à lista', async ({
	context,
	page,
	extensionId
}) => {
	await signIn(context);
	let down = true;
	await page.route(`${SERVER}/**`, async (route) => {
		if (down)
			return route.fulfill({ status: 503, json: { error: 'unavailable', message: 'x' } });
		const url = new URL(route.request().url());
		if (url.pathname === '/entries')
			return route.fulfill({ json: [entry(1, 'Sousou no Frieren')] });
		return route.fulfill({ json: [] });
	});
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	const error = page.locator('[data-error-screen="unavailable"]');
	await expect(error).toBeVisible();
	// Only the error on screen: no pill bar, and everything fits the 600px popup without scrolling.
	await expect(page.getByRole('navigation')).toHaveCount(0);
	const fits = await error.evaluate((node) => node.getBoundingClientRect().bottom <= 600);
	expect(fits).toBe(true);
	await expect(page.getByRole('button', { name: /Tentar de novo|Try again/ })).toBeInViewport();
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `${SHOTS}/09-erro.png` });

	down = false;
	await page.getByRole('button', { name: /Tentar de novo|Try again/ }).click();
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
});
