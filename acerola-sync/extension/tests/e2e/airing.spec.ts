import { expect, test } from './fixtures';

// New episode: the background checks the server, puts the number on the icon and notifies
// through the system what aired since the last check. Runs with the real extension and a fake server.

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
	// Episode 8 airs tomorrow: the last aired is 7. On the first look, 7 becomes the baseline.
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
				session: {
					token: 'tok',
					user: { id: 1, name: 'v', avatarUrl: null, siteUrl: null }
				}
			}),
		[SERVER]
	);

	// Closing the popup requests the check.
	const check = async () => {
		await page.goto(`chrome-extension://${extensionId}/popup.html`);
		await page.waitForTimeout(500);
		await page.goto('about:blank');
		await expect
			.poll(() => worker.evaluate(() => chrome.storage.local.get('airingSeen')))
			.toMatchObject({ airingSeen: { 1: nextEpisode - 1 } });
	};

	await check();
	// Anime 1 is at 5 with 7 aired (behind); anime 2 is up to date.
	expect(await worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('1');
	const created: string[] = await worker.evaluate(() =>
		chrome.notifications.getAll().then((all) => Object.keys(all))
	);
	expect(created).toEqual([]);

	nextEpisode = 9; // episode 8 aired
	await check();
	const after: string[] = await worker.evaluate(() =>
		chrome.notifications.getAll().then((all) => Object.keys(all))
	);
	expect(after).toEqual(['airing:1:8']);

	// The notice also stays on the notifications screen: the bell gets the dot and the screen lists the episode.
	await page.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(page.locator('[data-unread-dot]')).toBeVisible();
	await page.locator('[data-notifications-bell]').click();
	await expect(page.locator('[data-notification="airing:1:8"]')).toContainText('Anime 1');
	await expect(page.locator('[data-unread-dot]')).toHaveCount(0);
});
