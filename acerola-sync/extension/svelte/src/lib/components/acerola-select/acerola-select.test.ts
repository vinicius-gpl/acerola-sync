import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AcerolaSelect from './acerola-select.svelte';
import type { AcerolaSelectOption } from './acerola-select.svelte';

describe('AcerolaSelect', () => {
	const options: AcerolaSelectOption[] = [
		{ value: 'pt-br', label: 'Português' },
		{ value: 'en', label: 'Inglês' }
	];

	it('renders the select with the placeholder', () => {
		render(AcerolaSelect, {
			props: {
				data: { options },
				ui: { placeholder: 'Escolha o idioma' }
			}
		});

		// o componente subjacente do bits-ui usa um botão com a role combobox,
		// mas sem a montagem completa de JS às vezes é apenas um botão
		const trigger = screen.getByText('Escolha o idioma');
		expect(trigger).toBeInTheDocument();
	});

	it('displays the correct label according to the value', () => {
		render(AcerolaSelect, { props: { data: { options }, state: { value: 'pt-br' } } });
		expect(screen.getByText('Português')).toBeInTheDocument();
	});

	it('opens options on click and allows selecting an option', async () => {
		const user = userEvent.setup();
		render(AcerolaSelect, {
			props: {
				data: { options },
				ui: { placeholder: 'Selecione...' }
			}
		});

		const trigger = screen.getByText('Selecione...');
		await user.click(trigger);

		// roles de opções do bits-ui select às vezes podem ser difíceis de consultar no JSDom
		// Vamos consultar por texto para garantir, já que está definitivamente renderizado
		const option = await screen.findByText('Inglês');
		expect(option).toBeInTheDocument();

		await user.click(option);

		// Após clicar na opção, o gatilho deve agora exibir "Inglês"
		expect(screen.getByText('Inglês')).toBeInTheDocument();
	});
});
