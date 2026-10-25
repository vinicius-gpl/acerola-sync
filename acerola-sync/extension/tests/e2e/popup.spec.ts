import { expect, test } from './fixtures';

test('popup abre com o nome da extensão', async ({ page, extensionId }) => {
	// Abre o popup como página comum da extensão
	await page.goto(`chrome-extension://${extensionId}/popup.html`);

	await expect(page.getByRole('heading', { name: 'Acerola Sync' })).toBeVisible();
});
