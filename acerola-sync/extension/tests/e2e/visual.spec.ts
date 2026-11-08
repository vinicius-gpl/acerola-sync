import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Testes de layout de verdade (Chromium headless): o jsdom dos testes unitários não mede nada,
// então indicador desalinhado, texto cortado e pulo de layout só aparecem aqui. Cada estado
// também vira screenshot em `test-results/visual/` para conferência.

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
				session: { token: 'tok', user: { id: 1, name: 'vinicius', avatarUrl: null, siteUrl: null } }
			}),
		[SERVER]
	);
}

async function mockServer(page: Page) {
	await page.route(`${SERVER}/**`, async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === '/entries/counts') {
			// Anime tem "Reassistindo" (aba a mais); mangá não: a faixa muda de tamanho na troca.
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
		return route.fulfill({ status: 404, json: { errorType: 'not_found', message: url.pathname } });
	});
}

type Box = { x: number; y: number; width: number; height: number };

/** Caixa do indicador deslizante e do item ativo, já no fim da animação. */
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

/** A pílula cobre a ficha ativa (ou a barra fica embaixo dela, se `underline`). */
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
				// A pílula não pode passar da faixa (ali ela é cortada reta pelo overflow).
				const box = (await container.boundingBox())!;
				const outside = Math.max(
					box.x - indicator.x,
					indicator.x + indicator.width - (box.x + box.width)
				);
				return underline || outside <= 0.05 ? 'ok' : `pílula cortada ${outside.toFixed(2)}px`;
			},
			{ timeout: 3000 }
		)
		.toBe('ok');
}

// Mesmo tamanho do popup (`w-[440px] h-[600px]`).
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

	// Anime → Mangá: "Watching" vira "Reading" na mesma ficha ativa e some uma aba.
	await types.getByRole('tab', { name: /Mang/ }).click();
	await expect(page.getByText('Chainsaw Man').first()).toBeVisible();
	await expectAligned(statuses);
	await expectAligned(types, true);
	await page.screenshot({ path: `${SHOTS}/02-manga.png` });

	await types.getByRole('tab', { name: /Anime/ }).click();
	await expect(page.getByText('Sousou no Frieren').first()).toBeVisible();
	await expectAligned(statuses);
	await expectAligned(types, true);

	// Última ficha (fora da área visível): rola até ela e a pílula vai junto.
	const last = statuses.getByRole('tab').last();
	await last.click();
	await expectAligned(statuses);
	await page.screenshot({ path: `${SHOTS}/03-ultima-ficha.png` });
	await expect(statuses).toHaveAttribute('data-fade', /start|both/);

	// Nada da faixa pode ficar fora da moldura.
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
	// Espera a entrada da tela (GSAP) assentar antes de medir.
	await expect
		.poll(async () => {
			const first = await layout();
			await page.waitForTimeout(120);
			return Math.abs((await layout()).tabs.y - first.tabs.y);
		})
		.toBe(0);
	const before = await layout();

	await page.getByRole('tab', { name: /Mang/ }).click();
	// Mede durante a troca (antes, no meio e depois de a lista chegar): nada pode pular.
	for (const wait of [0, 60, 200, 500]) {
		await page.waitForTimeout(wait);
		const now = await layout();
		expect(Math.abs(now.tabs.y - before.tabs.y), `abas em ${wait}ms`).toBeLessThanOrEqual(1);
		expect(Math.abs(now.search.y - before.search.y), `busca em ${wait}ms`).toBeLessThanOrEqual(1);
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

	// Lista rolada antes de abrir a obra: a obra tem que abrir do topo, com as ações à vista.
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

	// O cartão inteiro cabe no popup.
	const panel = (await hours.locator('xpath=../../..').boundingBox())!;
	expect(panel.x).toBeGreaterThanOrEqual(0);
	expect(panel.x + panel.width).toBeLessThanOrEqual(440);
	expect(panel.y).toBeGreaterThanOrEqual(0);
	expect(panel.y + panel.height).toBeLessThanOrEqual(600);

	// A hora selecionada está visível dentro da coluna (rolou até ela).
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
	// Em português ("Mangá", nomes maiores) foi onde quebrou.
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
	// A pílula ativa fica inteira dentro da moldura, com a folga da borda dos dois lados.
	const frame = (await types.locator('xpath=..').boundingBox())!;
	const pill = (await types.getByRole('tab', { selected: true }).boundingBox())!;
	expect(pill.x + pill.width).toBeLessThanOrEqual(frame.x + frame.width - 3);
	expect(pill.x).toBeGreaterThanOrEqual(frame.x + 3);
	// A pílula (indicador) não pode passar da faixa que rola: lá ela é cortada reta.
	const clip = await types.evaluate((node) => {
		const list = node.getBoundingClientRect();
		const pill = [...node.children]
			.find((child) => child.classList.contains('pointer-events-none'))!
			.getBoundingClientRect();
		return { left: pill.left - list.left, right: list.right - pill.right };
	});
	expect(clip.left).toBeGreaterThanOrEqual(0);
	expect(clip.right).toBeGreaterThanOrEqual(0);
	// E a pílula tem o tamanho da ficha (medida depois do zoom de entrada do diálogo).
	const fit = await types.evaluate((node) => {
		const pill = [...node.children]
			.find((child) => child.classList.contains('pointer-events-none'))!
			.getBoundingClientRect();
		const tab = node.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
		return Math.max(Math.abs(pill.left - tab.left), Math.abs(pill.right - tab.right));
	});
	expect(fit).toBeLessThanOrEqual(0.1);
});
