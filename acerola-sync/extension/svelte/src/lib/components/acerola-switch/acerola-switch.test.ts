import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaSwitch from './acerola-switch.svelte';

describe('AcerolaSwitch', () => {
	it('renders correctly', () => {
		render(AcerolaSwitch);
		expect(screen.getByRole('switch')).toBeInTheDocument();
	});

	it('changes state when clicked', async () => {
		const user = userEvent.setup();
		let checked = false;
		render(AcerolaSwitch, {
			props: {
				events: { onCheckedChange: (value: boolean) => (checked = value) }
			}
		});

		const switchEl = screen.getByRole('switch');
		await user.click(switchEl);

		expect(switchEl.getAttribute('aria-checked')).toBe('true');
		expect(checked).toBe(true);
	});
});
