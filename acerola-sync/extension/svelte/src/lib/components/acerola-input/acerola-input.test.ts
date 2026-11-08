import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AcerolaInput from './acerola-input.svelte';

describe('AcerolaInput', () => {
	it('renders an input', () => {
		render(AcerolaInput);
		expect(screen.getByRole('textbox')).toBeInTheDocument();
	});

	it('displays the placeholder', () => {
		render(AcerolaInput, { props: { ui: { placeholder: 'Digite algo...' } } });
		expect(screen.getByPlaceholderText('Digite algo...')).toBeInTheDocument();
	});

	it('displays the initial value', () => {
		render(AcerolaInput, { props: { state: { value: 'texto inicial' } } });
		expect(screen.getByDisplayValue('texto inicial')).toBeInTheDocument();
	});

	it('is disabled when disabled prop is provided', () => {
		render(AcerolaInput, { props: { ui: { disabled: true } } });
		expect(screen.getByRole('textbox')).toBeDisabled();
	});

	it('accepts typing', async () => {
		const user = userEvent.setup();
		render(AcerolaInput, { props: { ui: { placeholder: 'Digite...' } } });
		const input = screen.getByPlaceholderText('Digite...');
		await user.type(input, 'quadrinhos');
		expect(input).toHaveValue('quadrinhos');
	});

	it('applies rounded-lg class', () => {
		render(AcerolaInput);
		expect(screen.getByRole('textbox')).toHaveClass('rounded-lg');
	});
});
