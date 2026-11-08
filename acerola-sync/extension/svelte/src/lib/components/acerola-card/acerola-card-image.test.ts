import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import AcerolaCardImage from './acerola-card-image.svelte';

describe('AcerolaCardImage', () => {
	it('renders the title', () => {
		render(AcerolaCardImage, {
			data: {
				title: 'Berserk'
			}
		});

		expect(screen.getByText('Berserk')).toBeInTheDocument();
	});

	it('renders the image when cover is provided', () => {
		render(AcerolaCardImage, {
			data: {
				title: 'Berserk',
				cover: '/capas/berserk.jpg'
			}
		});

		const img = screen.getByRole('img', {
			name: 'Berserk'
		});

		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('src', '/capas/berserk.jpg');
	});

	it('renders fallback when cover is null', () => {
		render(AcerolaCardImage, {
			data: {
				title: 'Berserk',
				cover: null
			}
		});

		expect(
			screen.queryByRole('img', {
				name: 'Berserk'
			})
		).not.toBeInTheDocument();
	});

	it('renders progress bar when progress is provided', () => {
		const { container } = render(AcerolaCardImage, {
			data: {
				title: 'Berserk',
				progress: 50
			}
		});

		const bar = container.querySelector('.bg-primary');

		expect(bar).toBeInTheDocument();
		expect(bar).toHaveStyle('width: 50%');
	});

	it('does not render progress bar when progress is not provided', () => {
		const { container } = render(AcerolaCardImage, {
			data: {
				title: 'Berserk'
			}
		});

		const bar = container.querySelector('.h-1.bg-surface');

		expect(bar).not.toBeInTheDocument();
	});

	it('clamps progress between 0 and 100', () => {
		const { container } = render(AcerolaCardImage, {
			data: {
				title: 'Berserk',
				progress: 150
			}
		});

		const bar = container.querySelector('.bg-primary');

		expect(bar).toHaveStyle('width: 100%');
	});

	it('applies w-36 by default', () => {
		const { container } = render(AcerolaCardImage, {
			data: {
				title: 'Berserk'
			}
		});

		expect(container.firstChild).toHaveClass('w-36');
	});
});
