import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { makeLog } from '../../../../tests/fixtures/media';
import AcerolaLogConsole from './acerola-log-console.svelte';

describe('AcerolaLogConsole', () => {
	it('lista as linhas com o nível', () => {
		const { container } = render(AcerolaLogConsole, {
			props: { data: { logs: [makeLog(1, 'começou'), makeLog(2, 'deu ruim', 'ERROR')] } }
		});
		expect(screen.getByRole('log')).toBeInTheDocument();
		expect(screen.getByText('começou')).toBeInTheDocument();
		expect(container.querySelector('.bg-destructive')).toBeInTheDocument();
	});

	it('mostra o vazio e o cursor enquanto roda', () => {
		const { container, rerender } = render(AcerolaLogConsole, {
			props: { data: { logs: [], empty: 'Nenhum sync ainda' } }
		});
		expect(screen.getByText('Nenhum sync ainda')).toBeInTheDocument();

		rerender({ data: { logs: [], running: true, empty: 'Nenhum sync ainda' } });
		expect(screen.queryByText('Nenhum sync ainda')).not.toBeInTheDocument();
		expect(container.querySelector('[data-log-running]')).toBeInTheDocument();
	});
});
