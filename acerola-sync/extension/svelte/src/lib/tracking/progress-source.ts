import type { CustomSite, ProgressSource } from '$lib/api/types';
import { parseProgress } from './types';

// Número do capítulo/episódio fora da URL. Sites como a Kuro Mangás usam um id interno na URL
// (`/read/2507/463111`) e só mostram o número no HTML ("Cap. 30" no título da página). O site
// personalizado diz de onde ler (título da página ou um elemento) e, opcionalmente, uma regex
// que tira o número do texto.

/** O que a página mostra de texto onde o número costuma estar. */
export type PageSnapshot = {
	url: string;
	title: string;
	h1: string | null;
	/** Opção marcada nos `<select>` da página (o seletor de capítulos de muitos leitores). */
	selected: string | null;
	/** Texto do seletor configurado, quando há um. */
	selectorText: string | null;
};

/** Palavra de capítulo/episódio seguida do número. Sugestão padrão e leitura sem regex. */
export const CHAPTER_PATTERN =
	'(?:cap[íi]tulo|cap|chapter|ch|epis[óo]dio|episode|ep)\\.?\\s*(?<progress>\\d+(?:[.,]\\d+)?)';

function compile(pattern: string): RegExp | null {
	try {
		return new RegExp(pattern, 'i');
	} catch {
		return null;
	}
}

/**
 * Número dentro de um texto. Com regex, vale o grupo `progress`, senão o primeiro grupo, senão o
 * trecho todo. Sem regex, procura "Cap. 30"/"Episódio 4"; sem palavra, o primeiro número.
 */
export function extractProgress(text: string | null | undefined, pattern?: string | null) {
	if (!text) return null;
	const regex = compile(pattern?.trim() || CHAPTER_PATTERN);
	const match = regex?.exec(text);
	if (match) return parseProgress(match.groups?.progress ?? match[1] ?? match[0]);
	return pattern?.trim() ? null : parseProgress(text);
}

/** Texto de onde o site lê o número. */
export function sourceText(source: ProgressSource, snapshot: PageSnapshot): string | null {
	if (source === 'title') return snapshot.title;
	if (source === 'selector') return snapshot.selectorText;
	return null;
}

export function progressFromSnapshot(
	site: Pick<CustomSite, 'progressSource' | 'progressPattern'>,
	snapshot: PageSnapshot
): number | null {
	const source = site.progressSource ?? 'url';
	if (source === 'url') return null;
	return extractProgress(sourceText(source, snapshot), site.progressPattern);
}

/**
 * Lê da página só o que importa. Também roda dentro da aba pelo `scripting`, que serializa a
 * função: nada de imports nem helpers de fora aqui dentro.
 */
export function snapshotPage(selector: string | null, doc: Document = document): PageSnapshot {
	const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || null;
	let selectorText: string | null = null;
	if (selector) {
		try {
			selectorText = clean(doc.querySelector(selector)?.textContent);
		} catch {
			selectorText = null;
		}
	}
	const selected = [...doc.querySelectorAll('select')]
		.map((select) => clean(select.selectedOptions[0]?.textContent))
		.find(Boolean);
	return {
		url: doc.URL,
		title: clean(doc.title) ?? '',
		h1: clean(doc.querySelector('h1')?.textContent),
		selected: selected ?? null,
		selectorText
	};
}

export type ProgressSuggestion = {
	source: Exclude<ProgressSource, 'url'>;
	selector: string | null;
	pattern: string;
	progress: number;
	/** Texto onde achou, para mostrar na tela. */
	text: string;
};

/**
 * Onde a página parece mostrar o número ("Cap. 30" no título, no `h1` ou no seletor de
 * capítulos). É só sugestão: quem confirma é a pessoa, porque links de próximo/anterior e
 * contadores de página também têm números.
 */
export function suggestProgress(snapshot: PageSnapshot): ProgressSuggestion | null {
	const regex = compile(CHAPTER_PATTERN)!;
	const places: [ProgressSuggestion['source'], string | null, string | null][] = [
		['title', null, snapshot.title],
		['selector', 'h1', snapshot.h1],
		['selector', 'select option:checked', snapshot.selected]
	];
	for (const [source, selector, text] of places) {
		const match = text ? regex.exec(text) : null;
		const progress = match ? parseProgress(match.groups?.progress) : null;
		if (text && progress) return { source, selector, pattern: CHAPTER_PATTERN, progress, text };
	}
	return null;
}
