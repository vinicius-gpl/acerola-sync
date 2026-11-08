import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaProgressStepper from './acerola-progress-stepper.svelte';

describe('AcerolaProgressStepper', () => {
	it('sobe e desce respeitando o total', async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(AcerolaProgressStepper, {
			props: {
				data: { value: 3, max: 12, caption: 'de 12' },
				events: { onChange },
				ui: { decrementLabel: 'menos', incrementLabel: 'mais' }
			}
		});

		await user.click(screen.getByRole('button', { name: 'mais' }));
		expect(onChange).toHaveBeenLastCalledWith(4);
		await user.click(screen.getByRole('button', { name: 'menos' }));
		expect(onChange).toHaveBeenLastCalledWith(2);
		expect(screen.getByText('de 12')).toBeInTheDocument();
	});

	it('trava no zero e no total', () => {
		render(AcerolaProgressStepper, {
			props: {
				data: { value: 12, max: 12 },
				ui: { decrementLabel: 'menos', incrementLabel: 'mais' }
			}
		});
		expect(screen.getByRole('button', { name: 'mais' })).toBeDisabled();

		render(AcerolaProgressStepper, {
			props: { data: { value: 0 }, ui: { decrementLabel: 'menos2', incrementLabel: 'mais2' } }
		});
		expect(screen.getByRole('button', { name: 'menos2' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'mais2' })).toBeEnabled();
	});
});
