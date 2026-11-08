import { fireEvent, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AcerolaListFilters, {
	EMPTY_FILTERS,
	activeFilterCount
} from './acerola-list-filters.svelte';

const facets = { genres: ['Drama', 'Fantasy'], formats: ['TV', 'MOVIE'], years: [2024, 2016] };

function setup(value = EMPTY_FILTERS) {
	const onChange = vi.fn();
	const view = render(AcerolaListFilters, {
		props: { data: { value, facets }, events: { onChange }, ui: { debounceMs: 200 } }
	});
	return { onChange, ...view };
}

describe('AcerolaListFilters', () => {
	afterEach(() => vi.useRealTimers());

	it('conta só os filtros do painel', () => {
		expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
		expect(
			activeFilterCount({ ...EMPTY_FILTERS, q: 'x', sort: 'title', genres: ['A', 'B'], year: 2020 })
		).toBe(3);
	});

	it('a busca espera a digitação parar antes de avisar', async () => {
		vi.useFakeTimers();
		const { onChange } = setup();
		const input = screen.getByRole('searchbox');
		await fireEvent.input(input, { target: { value: 'fri' } });
		await fireEvent.input(input, { target: { value: 'frieren' } });
		vi.advanceTimersByTime(199);
		expect(onChange).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...EMPTY_FILTERS, q: 'frieren' });
	});

	it('abre o painel com as opções da lista e liga/desliga as fichas', async () => {
		const user = userEvent.setup();
		const { onChange } = setup({ ...EMPTY_FILTERS, genres: ['Drama'] });
		expect(document.querySelector('[data-filters-count]')?.textContent).toBe('1');

		await user.click(screen.getByRole('button', { name: 'Filtros' }));
		expect(document.querySelector('[data-filters-panel]')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Fantasy' }));
		expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, genres: ['Drama', 'Fantasy'] });
		await user.click(screen.getByRole('button', { name: 'Drama' }));
		expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, genres: [] });

		await user.click(screen.getByRole('button', { name: 'Filme' }));
		expect(onChange).toHaveBeenLastCalledWith({
			...EMPTY_FILTERS,
			genres: ['Drama'],
			formats: ['MOVIE']
		});
		await user.click(screen.getByRole('button', { name: '2016' }));
		expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, genres: ['Drama'], year: 2016 });
		await user.click(screen.getByRole('button', { name: 'Sua nota' }));
		expect(onChange).toHaveBeenLastCalledWith({
			...EMPTY_FILTERS,
			genres: ['Drama'],
			sort: 'score'
		});
	});

	it('limpar volta tudo ao padrão', async () => {
		const user = userEvent.setup();
		const { onChange } = setup({ ...EMPTY_FILTERS, year: 2024, sort: 'title' });
		await user.click(screen.getByRole('button', { name: 'Filtros' }));
		await user.click(screen.getByRole('button', { name: 'Limpar' }));
		expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS);
	});
});
