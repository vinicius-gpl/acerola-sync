import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AcerolaCard from './acerola-card.svelte';

describe('AcerolaCard', () => {
	it('renders the title', () => {
		render(AcerolaCard, { props: { data: { title: 'Berserk' } } });
		expect(screen.getByText('Berserk')).toBeInTheDocument();
	});

	it('renders the description when provided', () => {
		render(AcerolaCard, { props: { data: { title: 'Berserk', description: 'Kentaro Miura' } } });
		expect(screen.getByText('Kentaro Miura')).toBeInTheDocument();
	});

	it('does not render description when not provided', () => {
		render(AcerolaCard, { props: { data: { title: 'Berserk' } } });
		expect(screen.queryByText('Kentaro Miura')).not.toBeInTheDocument();
	});

	it('applies the correct data-size on the card', () => {
		const { container } = render(AcerolaCard, {
			props: {
				data: { title: 'Berserk' },
				ui: { size: 'sm' }
			}
		});
		const card = container.querySelector("[data-slot='card']");
		expect(card).toHaveAttribute('data-size', 'sm');
	});

	it('applies custom class', () => {
		const { container } = render(AcerolaCard, {
			props: {
				data: { title: 'Berserk' },
				ui: { class: 'minha-classe' }
			}
		});
		const card = container.querySelector("[data-slot='card']");
		expect(card).toHaveClass('minha-classe');
	});
});
