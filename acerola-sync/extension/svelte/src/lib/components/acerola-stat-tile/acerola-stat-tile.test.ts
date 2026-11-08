import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AcerolaStatTile from './acerola-stat-tile.svelte';

describe('AcerolaStatTile', () => {
	it('mostra rótulo, número e dica', () => {
		render(AcerolaStatTile, {
			props: { data: { label: 'Assistindo', value: 12, hint: 'animes' }, ui: { tone: 'primary' } }
		});
		expect(screen.getByText('Assistindo')).toBeInTheDocument();
		expect(screen.getByText('animes')).toBeInTheDocument();
		expect(screen.getByText('Assistindo').parentElement).toHaveClass('bg-primary-soft');
	});

	it('aceita texto como valor', () => {
		render(AcerolaStatTile, { props: { data: { label: 'Último sync', value: '14:02' } } });
		expect(screen.getByText('14:02')).toBeInTheDocument();
	});
});
