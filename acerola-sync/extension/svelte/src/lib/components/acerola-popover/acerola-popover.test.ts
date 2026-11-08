import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AcerolaPopover from './acerola-popover.svelte';

describe('AcerolaPopover', () => {
	it('renders the trigger and opens content on click', async () => {
		const trigger = createRawSnippet(() => ({
			render: () => '<button>Abrir Popover</button>'
		}));
		const content = createRawSnippet(() => ({
			render: () => '<div>Conteudo do Popover</div>'
		}));

		render(AcerolaPopover, {
			props: {
				trigger,
				content
			}
		});

		const button = document.querySelector<HTMLElement>('[data-popover-trigger]')!;
		expect(button).toBeInTheDocument();
		expect(screen.queryByText('Conteudo do Popover')).not.toBeInTheDocument();

		const user = userEvent.setup();
		await user.click(button);

		expect(screen.getByText('Conteudo do Popover')).toBeInTheDocument();
	});
});
