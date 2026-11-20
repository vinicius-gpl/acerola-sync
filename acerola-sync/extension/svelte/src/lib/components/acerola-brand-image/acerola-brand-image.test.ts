import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AcerolaBrandImage from './acerola-brand-image.svelte';

describe('AcerolaBrandImage', () => {
	it('carrega a mascote da CDN da marca', () => {
		render(AcerolaBrandImage, { props: { data: { asset: 'mascot', alt: 'Mascote' } } });
		expect(screen.getByAltText('Mascote')).toHaveAttribute(
			'src',
			'https://cdn.acerola.app/brand/mascot/acerola-mascot.svg'
		);
	});

	it('cai para a cópia da extensão quando a CDN falha', async () => {
		render(AcerolaBrandImage, { props: { data: { asset: 'logo', alt: 'Acerola' } } });
		const img = screen.getByAltText('Acerola');
		expect(img.getAttribute('src')).toContain('cdn.acerola.app/brand/logo/');

		await fireEvent.error(img);
		expect(img.getAttribute('src')).toContain('/brand/acerola-logo.svg');
		expect(img.getAttribute('src')).not.toContain('cdn.acerola.app');
	});
});
