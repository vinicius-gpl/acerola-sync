import ListIcon from '@lucide/svelte/icons/list';
import SearchIcon from '@lucide/svelte/icons/search';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaPillNav from './acerola-pill-nav.svelte';

const items = [
	{ id: 'list', label: 'Lista', icon: ListIcon },
	{ id: 'search', label: 'Buscar', icon: SearchIcon }
];

describe('AcerolaPillNav', () => {
	it('marca o item ativo e mostra só o nome dele', () => {
		render(AcerolaPillNav, { props: { data: { items, active: 'list' } } });

		expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('button', { name: 'Buscar' })).not.toHaveAttribute('aria-current');
		expect(screen.getByText('Lista')).toBeInTheDocument();
		expect(screen.queryByText('Buscar')).not.toBeInTheDocument();
	});

	it('avisa o item escolhido', async () => {
		const onSelect = vi.fn();
		render(AcerolaPillNav, { props: { data: { items, active: 'list' }, events: { onSelect } } });
		await userEvent.setup().click(screen.getByRole('button', { name: 'Buscar' }));
		expect(onSelect).toHaveBeenCalledWith('search');
	});
});
