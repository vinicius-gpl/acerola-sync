import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AcerolaToggleGroup from './acerola-toggle-group.svelte';

describe('AcerolaToggleGroup', () => {
	it('renders the toggle group', () => {
		let value = 'bold';
		const children = createRawSnippet(() => ({
			render: () =>
				'<div><button data-value="bold">Bold</button><button data-value="italic">Italic</button></div>'
		}));

		render(AcerolaToggleGroup, {
			children,
			state: { value },
			config: { type: 'single' }
		});

		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(2);
		expect(screen.getByRole('group')).toBeInTheDocument();
	});
});
