import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaErrorScreen from './acerola-error-screen.svelte';

describe('AcerolaErrorScreen', () => {
	it('server fora do ar: tentar de novo é a ação principal', async () => {
		const onRetry = vi.fn();
		const onHome = vi.fn();
		render(AcerolaErrorScreen, {
			props: { data: { status: 503, kind: 'unavailable' }, events: { onRetry, onHome } }
		});

		expect(
			screen.getByRole('heading', { name: 'Fora do ar por um momento' })
		).toBeInTheDocument();
		expect(screen.getByText('Erro 503')).toBeInTheDocument();
		const [first, second] = screen.getAllByRole('button');
		expect(first).toHaveTextContent('Tentar de novo');
		expect(second).toHaveTextContent('Ir para o início');

		await userEvent.click(first);
		expect(onRetry).toHaveBeenCalled();
		await userEvent.click(second);
		expect(onHome).toHaveBeenCalled();
	});

	it('404 leva ao início primeiro e sem conexão não mostra código', () => {
		const { unmount } = render(AcerolaErrorScreen, {
			props: { data: { status: 404, kind: 'notFound' } }
		});
		expect(screen.getAllByRole('button')[0]).toHaveTextContent('Ir para o início');
		unmount();

		const { container } = render(AcerolaErrorScreen, {
			props: { data: { status: 0, kind: 'offline' } }
		});
		expect(screen.getByText('Sem conexão')).toBeInTheDocument();
		expect(container.querySelector('.code')).not.toBeInTheDocument();
	});
});
