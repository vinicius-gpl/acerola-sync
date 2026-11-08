import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaButtonIcon from './acerola-button-icon.svelte';

describe('AcerolaButtonIcon', () => {
	it('renders as a button', () => {
		render(AcerolaButtonIcon);
		expect(screen.getByRole('button')).toBeInTheDocument();
	});

	it('has square dimensions via class', () => {
		render(AcerolaButtonIcon);
		const button = screen.getByRole('button');
		expect(button.className).toContain('size-10');
	});

	it('calls onclick when clicked', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(AcerolaButtonIcon, { props: { events: { onClick: onclick } } });
		await user.click(screen.getByRole('button'));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('does not call onclick when disabled', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(AcerolaButtonIcon, {
			props: { events: { onClick: onclick }, ui: { disabled: true } }
		});
		await user.click(screen.getByRole('button'));

		expect(onclick).not.toHaveBeenCalled();
	});
});
