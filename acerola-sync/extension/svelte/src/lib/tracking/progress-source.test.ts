import { describe, expect, it } from 'vitest';
import {
	CHAPTER_PATTERN,
	extractProgress,
	progressFromSnapshot,
	snapshotPage,
	suggestProgress
} from './progress-source';

function page(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html');
}

describe('extractProgress', () => {
	it('usa o grupo progress, o primeiro grupo ou o trecho todo da regex', () => {
		expect(extractProgress('Cap. 30 — O Santuário', 'Cap\\.\\s*(?<progress>\\d+)')).toBe(30);
		expect(extractProgress('Capítulo 7 de 9', 'Capítulo (\\d+)')).toBe(7);
		expect(extractProgress('#12', '\\d+')).toBe(12);
		expect(extractProgress('Masmorra 2', 'Cap\\.\\s*(\\d+)')).toBeNull();
	});

	it('sem regex, prefere o número depois de "Cap."/"Episódio"', () => {
		expect(extractProgress('Masmorra da Torre 2 - Cap. 30')).toBe(30);
		expect(extractProgress('One Piece Episódio 1100')).toBe(1100);
		expect(extractProgress('Chapter 12.5')).toBe(12);
		expect(extractProgress('42')).toBe(42);
		expect(extractProgress(null)).toBeNull();
	});

	it('regex quebrada não lança', () => {
		expect(extractProgress('Cap. 3', '(')).toBeNull();
	});
});

describe('snapshotPage e progressFromSnapshot', () => {
	const doc = page(`
		<title>  Cap. 30 —  Kuro </title>
		<h1>Masmorra</h1>
		<select><option>Cap. 29</option><option selected>Cap. 30</option></select>
		<header><span class="cap">Cap. 30</span></header>`);

	it('lê título, h1, opção marcada e o seletor', () => {
		expect(snapshotPage('header .cap', doc)).toMatchObject({
			title: 'Cap. 30 — Kuro',
			h1: 'Masmorra',
			selected: 'Cap. 30',
			selectorText: 'Cap. 30'
		});
		expect(snapshotPage('[[inválido', doc).selectorText).toBeNull();
	});

	it('segue a fonte do site', () => {
		const snapshot = snapshotPage('header .cap', doc);
		expect(progressFromSnapshot({ progressSource: 'title' }, snapshot)).toBe(30);
		expect(progressFromSnapshot({ progressSource: 'selector' }, snapshot)).toBe(30);
		expect(progressFromSnapshot({ progressSource: 'url' }, snapshot)).toBeNull();
		expect(progressFromSnapshot({}, snapshot)).toBeNull();
	});
});

describe('suggestProgress', () => {
	it('sugere o título da página quando ele tem "Cap."', () => {
		const snapshot = snapshotPage(null, page('<title>Cap. 30 — Kuro</title><h1>Cap. 99</h1>'));
		expect(suggestProgress(snapshot)).toEqual({
			source: 'title',
			selector: null,
			pattern: CHAPTER_PATTERN,
			progress: 30,
			text: 'Cap. 30 — Kuro'
		});
	});

	it('cai no h1 e depois no seletor de capítulos', () => {
		expect(
			suggestProgress(snapshotPage(null, page('<title>Kuro</title><h1>Capítulo 8</h1>')))
		).toMatchObject({ source: 'selector', selector: 'h1', progress: 8 });
		expect(
			suggestProgress(
				snapshotPage(
					null,
					page('<title>Kuro</title><select><option selected>Ep 4</option></select>')
				)
			)
		).toMatchObject({ source: 'selector', selector: 'select option:checked', progress: 4 });
	});

	it('sem palavra de capítulo não sugere nada', () => {
		expect(suggestProgress(snapshotPage(null, page('<title>Página 1 de 31</title>')))).toBeNull();
	});
});
