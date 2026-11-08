import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AcerolaDialog from './acerola-dialog.svelte';

describe('AcerolaDialog', () => {
	it('should render correctly when open', () => {
		render(AcerolaDialog, {
			props: {
				state: { open: true },
				data: { title: 'Test Title', description: 'Test Desc' }
			}
		});

		expect(screen.getByText('Test Title')).toBeInTheDocument();
		expect(screen.getByText('Test Desc')).toBeInTheDocument();
	});

	it('should not render when closed', () => {
		render(AcerolaDialog, {
			props: {
				state: { open: false },
				data: { title: 'Test Title' }
			}
		});

		expect(screen.queryByText('Test Title')).toBeNull();
	});
});
