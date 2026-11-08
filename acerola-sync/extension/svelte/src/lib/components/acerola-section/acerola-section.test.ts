import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AcerolaSection from './acerola-section.svelte';

const body = createRawSnippet(() => ({ render: () => '<p>conteúdo</p>' }));

describe('AcerolaSection', () => {
	it('mostra título, dica e conteúdo', () => {
		render(AcerolaSection, {
			props: { data: { title: 'Agenda', hint: 'Horário de Brasília' }, children: body }
		});
		expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
		expect(screen.getByText('Horário de Brasília')).toBeInTheDocument();
		expect(screen.getByText('conteúdo')).toBeInTheDocument();
	});
});
