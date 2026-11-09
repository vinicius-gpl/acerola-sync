import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const executeScript = vi.fn();
vi.mock('wxt/browser', () => ({
	browser: { tabs: { query }, scripting: { executeScript } }
}));

const { evaluateSnapshot, testSiteOnTab } = await import('./site-test.service');

const kuro = {
	name: 'Kuro',
	mediaType: 'MANGA' as const,
	matchPattern: 'https://kuromangas.com/*',
	urlPattern: '/read/(?<id>\\d+)/\\d+',
	titleSelector: null,
	enabled: true,
	progressSource: 'title' as const,
	progressPattern: null
};

const snapshot = {
	url: 'https://kuromangas.com/read/2507/463111',
	title: 'Cap. 30 — O Santuário - Kuro',
	h1: null,
	selected: null,
	selectorText: null
};

describe('evaluateSnapshot', () => {
	it('acha obra pela URL e número pelo título', () => {
		expect(evaluateSnapshot(kuro, snapshot)).toEqual({
			status: 'ok',
			url: snapshot.url,
			id: '2507',
			progress: 30,
			suggestion: null
		});
	});

	it('com a fonte na URL e sem número nela, sugere o título', () => {
		const result = evaluateSnapshot({ ...kuro, progressSource: 'url' }, snapshot);
		expect(result.progress).toBeNull();
		expect(result.suggestion).toMatchObject({ source: 'title', progress: 30 });
	});
});

describe('testSiteOnTab', () => {
	beforeEach(() => {
		query.mockReset();
		executeScript.mockReset();
	});

	it('usa a aba do site acessada por último', async () => {
		query.mockResolvedValue([
			{ id: 1, lastAccessed: 10 },
			{ id: 2, lastAccessed: 99 }
		]);
		executeScript.mockResolvedValue([{ result: snapshot }]);
		expect(await testSiteOnTab(kuro)).toMatchObject({ status: 'ok', progress: 30 });
		expect(query).toHaveBeenCalledWith({ url: 'https://kuromangas.com/*' });
		expect(executeScript.mock.calls[0][0]).toMatchObject({ target: { tabId: 2 }, args: [null] });
	});

	it('sem aba do site aberta avisa', async () => {
		query.mockResolvedValue([]);
		expect(await testSiteOnTab(kuro)).toEqual({ status: 'no-tab' });
	});

	it('erro do navegador vira mensagem', async () => {
		query.mockRejectedValue(new Error('Invalid url pattern'));
		expect(await testSiteOnTab(kuro)).toEqual({ status: 'error', message: 'Invalid url pattern' });
	});
});
