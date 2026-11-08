import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeEntryWithMedia } from '../../../../tests/fixtures/media';
import AcerolaSpotlight from './acerola-spotlight.svelte';

describe('AcerolaSpotlight', () => {
	it('mostra a obra e soma +1', async () => {
		const onIncrement = vi.fn();
		render(AcerolaSpotlight, {
			props: {
				data: { entry: makeEntryWithMedia(), eyebrow: 'Continuar', caption: 'Ep 3 de 12' },
				events: { onIncrement }
			}
		});

		expect(screen.getByText('Continuar')).toBeInTheDocument();
		expect(screen.getByText('Ep 3 de 12')).toBeInTheDocument();
		await userEvent.setup().click(screen.getByRole('button', { name: /Somar 1|Add 1|\+1/ }));
		expect(onIncrement).toHaveBeenCalledOnce();
	});

	it('sem +1 quando já chegou no total', () => {
		render(AcerolaSpotlight, {
			props: {
				data: { entry: makeEntryWithMedia({ progress: 12 }), eyebrow: 'x', caption: 'y' },
				events: { onIncrement: vi.fn() }
			}
		});
		expect(screen.queryByRole('button', { name: /Somar 1|Add 1|\+1/ })).not.toBeInTheDocument();
	});
});
