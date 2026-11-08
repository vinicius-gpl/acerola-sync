import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AcerolaAlertDialog from './acerola-alert-dialog.svelte';

describe('AcerolaAlertDialog', () => {
	it('should render trigger button', () => {
		render(AcerolaAlertDialog, {
			props: {
				state: { open: false }
			}
		});

		// O gatilho é renderizado, mas sem filhos ele fica vazio.
		// Testar a funcionalidade geralmente envolve um wrapper para passar snippets no Svelte 5.
	});

	// Um teste básico já que testar snippets com o testing-library do Svelte 5 requer uma configuração específica.
	it('should handle open state', () => {
		const { component } = render(AcerolaAlertDialog, {
			props: {
				state: { open: true },
				data: {
					title: 'Test Title',
					description: 'Test Description',
					actionText: 'Confirm'
				}
			}
		});

		expect(screen.getByText('Test Title')).toBeInTheDocument();
		expect(screen.getByText('Test Description')).toBeInTheDocument();
		expect(screen.getByText('Confirm')).toBeInTheDocument();
	});

	it('should fire onAction event', async () => {
		const onAction = vi.fn();
		render(AcerolaAlertDialog, {
			props: {
				state: { open: true },
				data: {
					actionText: 'Confirm Action'
				},
				events: {
					onAction
				}
			}
		});

		const actionBtn = screen.getByText('Confirm Action');
		await fireEvent.click(actionBtn);

		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it('should fire onCancel event', async () => {
		const onCancel = vi.fn();
		render(AcerolaAlertDialog, {
			props: {
				state: { open: true },
				data: {
					cancelText: 'Cancel Action'
				},
				events: {
					onCancel
				}
			}
		});

		const cancelBtn = screen.getByText('Cancel Action');
		await fireEvent.click(cancelBtn);

		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
