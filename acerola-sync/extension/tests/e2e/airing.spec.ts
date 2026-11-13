import { expect, test } from './fixtures';

// Episódio novo: o background confere o server, põe o número no ícone e avisa pelo sistema o
// que saiu desde a última conferência. Roda com a extensão de verdade e o server simulado.

const SERVER = 'https://sync.test';

function animeEntry(mediaId: number, progress: number, nextAiringEpisode: number) {
	return {
		userId: 1,
		mediaId,
		status: 'CURRENT',
		progress,
		dirty: false,
		media: {
			id: mediaId,
			mediaType: 'ANIME',
			titleUserPreferred: `Anime ${mediaId}`,
			coverUrl: null,
			nextAiringEpisode,
			nextAiringAt: new Date(Date.now() + 86_400_000).toISOString()
		}
	};
}

test('número no ícone e aviso só do episódio que saiu depois da primeira olhada', async ({
	context,
	page,
	extensionId
}) => {
	// Episódio 8 de amanhã: o último lançado é o 7. Na primeira olhada, o 7 vira base.
	let nextEpisode = 8;
	await context.route(`${SERVER}/**`, (route) => {
		const url = new URL(route.request().url());
		if (url.pathname !== '/entries') return route.fulfill({ json: [] });
		const status = url.searchParams.get('status');
		return route.fulfill({
			json: status === 'CURRENT' ? [animeEntry(1, 5, nextEpisode), animeEntry(2, 9, 10)] : []
		});
	});
	const [worker] = context.serviceWorkers();
	await worker.evaluate(
		([server]) =>
			chrome.storage.local.set({
				serverUrl: server,
				session: { token: 'tok', user: { id: 1, name: 'v', avatarUrl: null, siteUrl: null } }
			}),
		[SERVER]
	);

	// Fechar o popup pede a conferência.
	const check = async () => {
		await page.goto(`chrome-extension://${extensionId}/popup.html`);
		await page.waitForTimeout(500);
		await page.goto('about:blank');
		await expect
			.poll(() => worker.evaluate(() => chrome.storage.local.get('airingSeen')))
			.toMatchObject({ airingSeen: { 1: nextEpisode - 1 } });
	};

	await check();
	// Anime 1 está no 5 com o 7 lançado (atrasado); o 2 está em dia.
	expect(await worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('1');
	const created: string[] = await worker.evaluate(() =>
		chrome.notifications.getAll().then((all) => Object.keys(all))
	);
	expect(created).toEqual([]);

	nextEpisode = 9; // saiu o 8
	await check();
	const after: string[] = await worker.evaluate(() =>
		chrome.notifications.getAll().then((all) => Object.keys(all))
	);
	expect(after).toEqual(['airing:1:8']);
});
