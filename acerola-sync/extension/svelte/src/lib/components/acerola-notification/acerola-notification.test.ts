import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import AcerolaNotification, { notificationStore } from './acerola-notification.svelte';

function getTrigger() {
	return document.querySelector<HTMLElement>('[data-popover-trigger]')!;
}

describe('AcerolaNotification', () => {
	beforeEach(() => {
		notificationStore.clearAll();
	});

	it('renders the notification button', () => {
		render(AcerolaNotification);
		expect(getTrigger()).toBeInTheDocument();
	});

	it('does not show badge when there are no notifications', () => {
		render(AcerolaNotification);
		expect(document.querySelector('.bg-primary.rounded-full')).not.toBeInTheDocument();
	});

	it('shows badge when there are notifications', () => {
		notificationStore.notify.success('Teste');
		render(AcerolaNotification);
		expect(document.querySelector('.bg-primary.rounded-full')).toBeInTheDocument();
	});

	it('opens popover and displays notification when clicking button', async () => {
		notificationStore.notify.success('Scan concluído!');
		render(AcerolaNotification);

		const user = userEvent.setup();
		await user.click(getTrigger());

		expect(screen.getByText('Scan concluído!')).toBeInTheDocument();
	});

	it('displays empty state when there are no notifications', async () => {
		render(AcerolaNotification);

		const user = userEvent.setup();
		await user.click(getTrigger());

		expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument();
	});

	it('removes notification when clicking X', async () => {
		notificationStore.notify.error('Erro de sync');
		render(AcerolaNotification);

		const user = userEvent.setup();
		await user.click(getTrigger());

		const closeBtn = document.querySelector<HTMLElement>('.size-6.shrink-0');
		await user.click(closeBtn!);

		expect(screen.queryByText('Erro de sync')).not.toBeInTheDocument();
	});

	it('clears all notifications when clicking clear all', async () => {
		notificationStore.notify.success('Notificação 1');
		notificationStore.notify.info('Notificação 2');
		render(AcerolaNotification);

		const user = userEvent.setup();
		await user.click(getTrigger());
		await user.click(screen.getByText('Limpar tudo'));

		expect(screen.queryByText('Notificação 1')).not.toBeInTheDocument();
		expect(screen.queryByText('Notificação 2')).not.toBeInTheDocument();
	});

	it('executes action and removes notification when clicking action button', async () => {
		const onClick = vi.fn();
		notificationStore.notify.success('Teste', {
			action: { label: 'Executar', onClick }
		});
		render(AcerolaNotification);

		const user = userEvent.setup();
		await user.click(getTrigger());

		const actionBtn = screen.getByText('Executar');
		await user.click(actionBtn);

		expect(onClick).toHaveBeenCalled();
		expect(screen.queryByText('Teste')).not.toBeInTheDocument();
	});
});
