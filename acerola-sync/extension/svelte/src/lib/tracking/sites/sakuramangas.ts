import { humanizeSlug, parseProgress, pathParts, type SiteAdapter } from '../types';

// Capítulo: https://sakuramangas.org/obras/<slug>/<capitulo>/
function chapterParts(url: URL) {
	const [section, slug, chapter] = pathParts(url);
	if (section !== 'obras' || !slug || !chapter) return null;
	return { slug, chapter };
}

// Obra: https://sakuramangas.org/obras/<slug>/
function overviewSlug(url: URL) {
	const [section, slug, chapter] = pathParts(url);
	return section === 'obras' && slug && !chapter ? slug : null;
}

export const sakuraMangas: SiteAdapter = {
	id: 'sakuramangas',
	name: 'Sakura Mangás',
	homepage: 'https://sakuramangas.org',
	mediaType: 'MANGA',
	trigger: 'delay',
	pageKey(url) {
		const parts = chapterParts(url);
		return parts ? `${parts.slug}/${parts.chapter}` : null;
	},
	async detect(url, doc) {
		const parts = chapterParts(url);
		if (!parts) return null;
		const progress = parseProgress(parts.chapter);
		if (!progress) return null;

		const title = doc.querySelector('#id-titulo')?.textContent?.trim() || humanizeSlug(parts.slug);
		return {
			site: this.id,
			identifier: parts.slug,
			title,
			progress,
			mediaType: this.mediaType,
			url: url.href
		};
	},
	async overview(url, doc) {
		const slug = overviewSlug(url);
		if (!slug) return null;
		return {
			site: this.id,
			identifier: slug,
			title: doc.querySelector('h1.h1-titulo, h1')?.textContent?.trim() || humanizeSlug(slug),
			progress: null,
			mediaType: this.mediaType,
			url: url.href
		};
	}
};
