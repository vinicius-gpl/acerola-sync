import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AcerolaBrandImage from './acerola-brand-image.svelte';

describe('AcerolaBrandImage', () => {
	it('usa a mascote empacotada, sem CDN', () => {
		render(AcerolaBrandImage, { props: { data: { asset: 'mascot', alt: 'Mascote' } } });
		const src = screen.getByAltText('Mascote').getAttribute('src') ?? '';
		expect(src).toContain('/brand/acerola-mascot.svg');
		expect(src).not.toMatch(/^https?:/);
	});

	it('usa a logo empacotada', () => {
		render(AcerolaBrandImage, { props: { data: { asset: 'logo', alt: 'Acerola' } } });
		expect(screen.getByAltText('Acerola').getAttribute('src')).toContain(
			'/brand/acerola-logo.svg'
		);
	});
});
