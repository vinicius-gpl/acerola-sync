import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaTimePicker, { parseTime } from './acerola-time-picker.svelte';

describe('AcerolaTimePicker', () => {
	it('lê HH:MM e cai em 00:00 no que não presta', () => {
		expect(parseTime('21:07')).toEqual({ hour: 21, minute: 7 });
		expect(parseTime('99:99')).toEqual({ hour: 0, minute: 0 });
		expect(parseTime('')).toEqual({ hour: 0, minute: 0 });
	});

	it('mostra a hora e abre colunas de 24h e minutos de 5 em 5', async () => {
		const user = userEvent.setup();
		render(AcerolaTimePicker, { props: { data: { value: '09:00', label: 'Novo horário' } } });

		const trigger = screen.getByRole('button', { name: 'Novo horário' });
		expect(trigger).toHaveTextContent('09:00');
		await user.click(trigger);

		const [hours, minutes] = await screen.findAllByRole('listbox', { hidden: true });
		expect(hours.querySelectorAll('[role=option]')).toHaveLength(24);
		expect(minutes.querySelectorAll('[role=option]')).toHaveLength(12);
		expect(hours.querySelector('[aria-selected=true]')).toHaveTextContent('09');
	});

	it('escolher hora e minuto avisa o novo valor', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(AcerolaTimePicker, {
			props: { data: { value: '09:00', label: 'Novo horário' }, events: { onChange } }
		});
		await user.click(screen.getByRole('button', { name: 'Novo horário' }));
		const [hours, minutes] = await screen.findAllByRole('listbox', { hidden: true });

		await user.click(
			[...hours.querySelectorAll('button')].find((b) => b.textContent?.trim() === '21')!
		);
		expect(onChange).toHaveBeenLastCalledWith('21:00');
		await user.click(
			[...minutes.querySelectorAll('button')].find((b) => b.textContent?.trim() === '30')!
		);
		expect(onChange).toHaveBeenLastCalledWith('09:30');
	});

	it('minuto fora do passo continua na lista e selecionado', async () => {
		render(AcerolaTimePicker, { props: { data: { value: '21:07', label: 'Novo horário' } } });
		await userEvent.setup().click(screen.getByRole('button', { name: 'Novo horário' }));
		const [, minutes] = await screen.findAllByRole('listbox', { hidden: true });
		expect(minutes.querySelectorAll('[role=option]')).toHaveLength(13);
		expect(minutes.querySelector('[aria-selected=true]')).toHaveTextContent('07');
	});
});
