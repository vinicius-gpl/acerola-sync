import InboxIcon from '@lucide/svelte/icons/inbox';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AcerolaEmptyState from './acerola-empty-state.svelte';

describe('AcerolaEmptyState', () => {
	it('mostra título e dica', () => {
		render(AcerolaEmptyState, {
			props: { data: { title: 'Nada aqui', hint: 'Sincronize', icon: InboxIcon } }
		});
		expect(screen.getByText('Nada aqui')).toBeInTheDocument();
		expect(screen.getByText('Sincronize')).toBeInTheDocument();
	});

	it('funciona sem dica nem ícone', () => {
		const { container } = render(AcerolaEmptyState, { props: { data: { title: 'Vazio' } } });
		expect(screen.getByText('Vazio')).toBeInTheDocument();
		expect(container.querySelector('svg')).not.toBeInTheDocument();
	});
});
