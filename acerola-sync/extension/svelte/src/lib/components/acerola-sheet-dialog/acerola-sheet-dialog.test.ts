import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AcerolaSheetDialog from './acerola-sheet-dialog.svelte';

describe('AcerolaSheetDialog', () => {
	it('folha sem borda com título grande e fechar redondo', async () => {
		const onOpenChange = vi.fn();
		render(AcerolaSheetDialog, {
			props: {
				state: { open: true },
				data: { title: 'Novo site', description: 'Rastreio pela URL.', closeLabel: 'Fechar' },
				events: { onOpenChange }
			}
		});

		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveClass('rounded-sheet', 'bg-card', 'shadow-float');
		expect(dialog.className).not.toMatch(/\bborder\b|ring-1/);
		expect(screen.getByRole('heading', { name: 'Novo site' })).toBeInTheDocument();

		await userEvent.setup().click(screen.getByRole('button', { name: 'Fechar' }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
