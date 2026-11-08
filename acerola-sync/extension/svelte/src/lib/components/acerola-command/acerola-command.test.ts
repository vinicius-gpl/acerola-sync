import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AcerolaCommand from './acerola-command.svelte';

describe('AcerolaCommand', () => {
	it('renders the command and handles value change', async () => {
		let value = '';
		const children = createRawSnippet(() => ({
			render: () =>
				'<div data-command-input-wrapper=""><input data-command-input="" role="textbox" /></div>'
		}));

		render(AcerolaCommand, {
			props: {
				children,
				state: { value },
				events: {
					onValueChange: (nextValue: string) => {
						value = nextValue;
					}
				}
			}
		});

		const input = screen.getByRole('textbox');
		expect(input).toBeInTheDocument();

		const user = userEvent.setup();
		await user.type(input, 'teste');

		expect(input).toBeInTheDocument();
	});
});
