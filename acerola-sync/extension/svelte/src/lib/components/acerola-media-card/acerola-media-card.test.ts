import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeEntry, makeMedia } from '../../../../tests/fixtures/media';
import AcerolaMediaCard from './acerola-media-card.svelte';

describe('AcerolaMediaCard', () => {
	it('mostra título, progresso e abre a obra', async () => {
		const onOpen = vi.fn();
		render(AcerolaMediaCard, {
			props: {
				data: { media: makeMedia(), entry: makeEntry({ progress: 3 }), subtitle: 'TV · 2024' },
				events: { onOpen }
			}
		});

		expect(screen.getByRole('heading', { name: 'Sousou no Frieren' })).toBeInTheDocument();
		expect(screen.getByText(/3\/12/)).toBeInTheDocument();
		expect(screen.getByText('TV · 2024')).toBeInTheDocument();

		await userEvent.setup().click(screen.getByRole('button', { name: 'Sousou no Frieren' }));
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('soma +1 quando pode', async () => {
		const onIncrement = vi.fn();
		const { container } = render(AcerolaMediaCard, {
			props: { data: { media: makeMedia(), entry: makeEntry() }, events: { onIncrement } }
		});

		const buttons = container.querySelectorAll('button');
		await userEvent.setup().click(buttons[buttons.length - 1]);
		expect(onIncrement).toHaveBeenCalledOnce();
	});

	it('esconde o +1 no total e mostra episódios atrasados', () => {
		const { container } = render(AcerolaMediaCard, {
			props: {
				data: {
					media: makeMedia({ status: 'RELEASING', nextAiringEpisode: 7, episodes: 12 }),
					entry: makeEntry({ progress: 4 })
				},
				events: { onIncrement: vi.fn() }
			}
		});
		expect(screen.getByText(/2/, { selector: 'span.bg-destructive' })).toBeInTheDocument();
		expect(container.querySelectorAll('button')).toHaveLength(2);

		render(AcerolaMediaCard, {
			props: {
				data: { media: makeMedia({ id: 2 }), entry: makeEntry({ progress: 12 }) },
				events: { onIncrement: vi.fn() }
			}
		});
		expect(screen.getAllByRole('button')).toHaveLength(3);
	});

	it('sem entrada, não mostra progresso', () => {
		render(AcerolaMediaCard, { props: { data: { media: makeMedia(), entry: null } } });
		expect(screen.queryByText(/\/12/)).not.toBeInTheDocument();
	});
});
