import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import TrashIcon from '@lucide/svelte/icons/trash-2';
import { describe, expect, it, vi } from 'vitest';
import AcerolaConfirmDialog from './acerola-confirm-dialog.svelte';

const data = {
	title: 'Remover da lista?',
	description: 'A entrada some daqui e do AniList.',
	actionText: 'Remover',
	cancelText: 'Cancelar',
	icon: TrashIcon
};

describe('AcerolaConfirmDialog', () => {
	it('fechado não mostra nada', () => {
		render(AcerolaConfirmDialog, { props: { state: { open: false }, data } });
		expect(screen.queryByText('Remover da lista?')).toBeNull();
	});

	it('aberto mostra título, descrição e as duas ações, sem borda', async () => {
		const onAction = vi.fn();
		render(AcerolaConfirmDialog, { props: { state: { open: true }, data, events: { onAction } } });

		const dialog = await screen.findByRole('alertdialog');
		expect(dialog).toHaveClass('rounded-sheet', 'bg-card');
		expect(dialog.className).not.toMatch(/\bborder\b|ring-1/);
		expect(screen.getByText('A entrada some daqui e do AniList.')).toBeInTheDocument();

		await userEvent.setup().click(screen.getByRole('button', { name: 'Remover' }));
		expect(onAction).toHaveBeenCalledOnce();
	});

	it('ocupado trava a ação', async () => {
		render(AcerolaConfirmDialog, {
			props: { state: { open: true }, data, ui: { busy: true, tone: 'primary' } }
		});
		expect(await screen.findByRole('button', { name: 'Remover' })).toBeDisabled();
	});
});
