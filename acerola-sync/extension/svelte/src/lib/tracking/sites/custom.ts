import type { CustomSite } from '$lib/api/types';
import { progressFromSnapshot, snapshotPage } from '../progress-source';
import { humanizeSlug, parseProgress, type SiteAdapter } from '../types';

/** Leituras iguais seguidas que confirmam um número repetido depois de trocar de página. */
const STALE_CONFIRMATIONS = 3;

export function customSiteId(site: Pick<CustomSite, 'id'>): string {
	return `custom:${site.id}`;
}

function exec(site: CustomSite, url: URL) {
	try {
		return new RegExp(site.urlPattern).exec(url.href)?.groups ?? null;
	} catch {
		return null;
	}
}

/** O número sai da URL (padrão) ou da página (título ou elemento). */
export function readsProgressFromPage(site: Pick<CustomSite, 'progressSource'>): boolean {
	return (site.progressSource ?? 'url') !== 'url';
}

/**
 * Site personalizado: a obra sai da URL, por uma regex com o grupo `id` (e `title`, opcional).
 * O número vem do grupo `progress` da mesma regex ou, quando a URL não tem (Kuro Mangás:
 * `/read/2507/463111`), do título da página ou de um elemento, ver `progress-source.ts`.
 */
export function createCustomAdapter(site: CustomSite): SiteAdapter {
	const fromPage = readsProgressFromPage(site);
	// Em SPA a URL troca antes do HTML: logo depois de ir para o próximo capítulo, a página ainda
	// mostra o número do anterior. Número igual ao da página anterior só vale depois de repetir.
	let accepted: { href: string; progress: number } | null = null;
	let repeated = { href: '', count: 0 };

	function pageProgress(url: URL, doc: Document): number | null {
		const progress = progressFromSnapshot(site, snapshotPage(site.progressSelector ?? null, doc));
		if (!progress) return null;
		if (accepted && accepted.href !== url.href && accepted.progress === progress) {
			repeated =
				repeated.href === url.href
					? { ...repeated, count: repeated.count + 1 }
					: { href: url.href, count: 1 };
			if (repeated.count < STALE_CONFIRMATIONS) return null;
		}
		accepted = { href: url.href, progress };
		return progress;
	}

	return {
		id: customSiteId(site),
		name: site.name,
		homepage: site.matchPattern,
		searchUrl: site.searchUrl
			? (title) => site.searchUrl!.replaceAll('{title}', encodeURIComponent(title))
			: undefined,
		mediaType: site.mediaType,
		trigger: site.mediaType === 'ANIME' ? 'video' : 'delay',
		pageKey(url) {
			const groups = exec(site, url);
			if (!groups?.id) return null;
			if (fromPage) return `${groups.id}${url.pathname}${url.search}`;
			return groups.progress ? `${groups.id}/${groups.progress}` : null;
		},
		async detect(url, doc) {
			const groups = exec(site, url);
			if (!groups?.id) return null;
			const progress = fromPage ? pageProgress(url, doc) : parseProgress(groups.progress);
			if (!progress) return null;

			const fromSelector = site.titleSelector
				? doc.querySelector(site.titleSelector)?.textContent?.trim()
				: undefined;
			const title =
				(groups.title && humanizeSlug(groups.title)) ||
				fromSelector ||
				humanizeSlug(groups.id) ||
				doc.title;

			return {
				site: customSiteId(site),
				identifier: groups.id,
				title,
				progress,
				mediaType: site.mediaType,
				url: url.href
			};
		}
	};
}
