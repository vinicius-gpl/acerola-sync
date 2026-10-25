import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import AcerolaButton from './acerola-button.svelte';

describe('AcerolaButton', () => {
	it('renders the content passed via slot', () => {
		const children = createRawSnippet(() => ({
			render: () => `<span>Clique aqui</span>`
		}));
		render(AcerolaButton, { props: { children } });
		expect(screen.getByText('Clique aqui')).toBeInTheDocument();
	});

	it('calls onclick when clicked', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(AcerolaButton, { props: { events: { onClick: onclick } } });
		await user.click(screen.getByRole('button'));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('does not call onclick when disabled', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(AcerolaButton, {
			props: { events: { onClick: onclick }, ui: { disabled: true } }
		});
		await user.click(screen.getByRole('button'));

		expect(onclick).not.toHaveBeenCalled();
	});
});
