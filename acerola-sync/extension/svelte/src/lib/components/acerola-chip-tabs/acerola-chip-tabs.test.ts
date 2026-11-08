import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaChipTabs from './acerola-chip-tabs.svelte';

const items = [
	{ id: 'CURRENT', label: 'Assistindo', count: 12 },
	{ id: 'COMPLETED', label: 'Completo', count: 340 },
	{ id: 'PLANNING', label: 'Planejado' }
];

describe('AcerolaChipTabs', () => {
	it('mostra as contagens e a aba ativa', () => {
		render(AcerolaChipTabs, { props: { data: { items, active: 'COMPLETED' } } });

		expect(screen.getByRole('tab', { name: /Completo/ })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: /Assistindo/ })).toHaveAttribute(
			'aria-selected',
			'false'
		);
		expect(screen.getByText('340')).toBeInTheDocument();
	});

	it('troca de aba', async () => {
		const onSelect = vi.fn();
		render(AcerolaChipTabs, {
			props: { data: { items, active: 'CURRENT' }, events: { onSelect } }
		});
		await userEvent.setup().click(screen.getByRole('tab', { name: /Planejado/ }));
		expect(onSelect).toHaveBeenCalledWith('PLANNING');
	});

	it('a rolagem fica dentro da moldura, que leva a trilha e a classe extra', () => {
		render(AcerolaChipTabs, {
			props: { data: { items, active: 'CURRENT' }, ui: { class: 'mt-4' } }
		});
		const list = screen.getByRole('tablist');
		const frame = list.parentElement!;
		expect(frame).toHaveAttribute('data-chip-frame');
		expect(frame).toHaveClass('bg-surface', 'p-1', 'mt-4');
		expect(list).toHaveClass('overflow-x-auto');
		expect(list).not.toHaveClass('p-1');
	});

	it('fade só do lado que tem fichas escondidas', async () => {
		render(AcerolaChipTabs, { props: { data: { items, active: 'CURRENT' } } });
		const list = screen.getByRole('tablist');
		expect(list).toHaveAttribute('data-fade', 'none');

		Object.defineProperties(list, {
			scrollWidth: { configurable: true, value: 400 },
			clientWidth: { configurable: true, value: 200 },
			scrollLeft: { configurable: true, writable: true, value: 0 }
		});
		list.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(list).toHaveAttribute('data-fade', 'end'));
		expect(list).toHaveClass('fade-x-end');

		list.scrollLeft = 100;
		list.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(list).toHaveAttribute('data-fade', 'both'));

		list.scrollLeft = 200;
		list.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(list).toHaveAttribute('data-fade', 'start'));
		// A troca de classe do fade não pode apagar o `relative` do indicador deslizante.
		expect(list).toHaveClass('relative');
	});
});
