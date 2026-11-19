import type { CustomSite, ProgressSource } from '$lib/api/types';
import { parseProgress } from './types';

// Chapter/episode number outside the URL. Sites like Kuro Mangás use an internal id in the URL
// (`/read/2507/463111`) and only show the number in the HTML ("Cap. 30" in the page title). The
// custom site says where to read it from (page title or an element) and, optionally, a regex
// that pulls the number from the text.

/** Text the page shows where the number usually is. */
export type PageSnapshot = {
	url: string;
	title: string;
	h1: string | null;
	/** Selected option of the page's `<select>`s (the chapter picker of many readers). */
	selected: string | null;
	/** Text of the configured selector, when there is one. */
	selectorText: string | null;
};

/** Chapter/episode word followed by the number. Default suggestion and regex-free read. */
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
 * Number inside a text. With a regex, the `progress` group wins, else the first group, else the
 * whole match. Without a regex, looks for "Cap. 30"/"Episódio 4"; with no word, the first number.
 */
export function extractProgress(text: string | null | undefined, pattern?: string | null) {
	if (!text) return null;
	const regex = compile(pattern?.trim() || CHAPTER_PATTERN);
	const match = regex?.exec(text);
	if (match) return parseProgress(match.groups?.progress ?? match[1] ?? match[0]);
	return pattern?.trim() ? null : parseProgress(text);
}

/** Text the site reads the number from. */
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
 * Reads only what matters from the page. It also runs inside the tab through `scripting`, which
 * serializes the function: no imports or outside helpers in here.
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
	/** Text where it was found, to show on screen. */
	text: string;
};

/**
 * Where the page seems to show the number ("Cap. 30" in the title, in the `h1` or in the chapter
 * picker). It is only a suggestion: the person confirms it, because next/previous links and
 * page counters also have numbers.
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
