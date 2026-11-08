import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaHeroButton from './acerola-hero-button.svelte';

describe('AcerolaHeroButton', () => {
	it('renders title and description correctly', () => {
		render(AcerolaHeroButton, {
			props: {
				data: {
					title: 'Pasta de Teste',
					description: 'Minha descrição de teste'
				}
			}
		});

		expect(screen.getByText('Pasta de Teste')).toBeInTheDocument();
		expect(screen.getByText('Minha descrição de teste')).toBeInTheDocument();
	});

	it('applies cursor-pointer class and hover state if onclick is provided', async () => {
		const handleClick = vi.fn();
		render(AcerolaHeroButton, {
			props: {
				data: {
					title: 'Item clicável'
				},
				events: {
					onClick: handleClick
				}
			}
		});

		const wrapper = screen.getByText('Item clicável').closest('[data-slot="item"]');

		expect(wrapper).toHaveClass('cursor-pointer');
		expect(wrapper).toHaveClass('hover:border-primary/50');

		const user = userEvent.setup();
		await user.click(wrapper as HTMLElement);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it('does not apply cursor-pointer if not clickable', () => {
		render(AcerolaHeroButton, {
			props: {
				data: {
					title: 'Apenas leitura'
				}
			}
		});

		const wrapper = screen.getByText('Apenas leitura').closest('[data-slot="item"]');
		expect(wrapper).not.toHaveClass('cursor-pointer');
		expect(wrapper).not.toHaveClass('hover:border-primary/50');
	});
});
