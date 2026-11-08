import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
	browser: { runtime: { getURL: (path: string) => `chrome-extension://abc${path}` } }
}));

import AcerolaSiteIcon from './acerola-site-icon.svelte';

describe('AcerolaSiteIcon', () => {
	it('mostra o favicon do site', () => {
		const { container } = render(AcerolaSiteIcon, {
			props: { data: { name: 'MangaDex', url: 'https://mangadex.org/*' } }
		});
		expect(container.querySelector('img')?.getAttribute('src')).toContain('_favicon');
	});

	it('cai na inicial quando o favicon falha ou não existe', async () => {
		const { container } = render(AcerolaSiteIcon, {
			props: { data: { name: 'leitor', url: 'https://leitor.exemplo.com/*' } }
		});
		await fireEvent.error(container.querySelector('img')!);
		expect(screen.getByText('L')).toBeInTheDocument();

		render(AcerolaSiteIcon, { props: { data: { name: 'sem url' } } });
		expect(screen.getByText('S')).toBeInTheDocument();
	});
});
