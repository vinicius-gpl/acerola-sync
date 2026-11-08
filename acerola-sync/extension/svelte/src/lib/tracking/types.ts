import type { MediaType } from '$lib/api/types';

/** O que um adapter achou na página: qual obra (no site) e qual episódio/capítulo. */
export type DetectedPage = {
	site: string;
	/** ID da obra no site (slug, uuid…). Junto com `site`, é a chave do mapeamento. */
	identifier: string;
	title: string;
	progress: number;
	mediaType: MediaType;
	/** Quando o próprio site informa o ID do AniList (o MangaDex informa). */
	anilistId?: number | null;
	url: string;
};

/** Página aberta na aba: capítulo/episódio (`progress`) ou só a página da obra (`null`). */
export type CurrentPage = Omit<DetectedPage, 'progress'> & { progress: number | null };

/**
 * `delay`: marca depois de alguns segundos na página (capítulo de mangá).
 * `video`: marca quando o vídeo passa de 85% (episódio de anime).
 */
export type TrackTrigger = 'delay' | 'video';

/**
 * Um site rastreável. Inspirado nos `pages` do MALSync, mas só com o que o Acerola usa: o
 * adapter identifica a página; quem decide se o progresso vale é o server.
 */
export type SiteAdapter = {
	id: string;
	name: string;
	/** Página inicial do site — de onde sai o favicon na tela de ajustes. */
	homepage: string;
	/** Busca do site pelo título (botão "abrir no site" da obra). */
	searchUrl?(title: string): string;
	mediaType: MediaType;
	trigger: TrackTrigger;
	/**
	 * Só marca se a obra já está na lista ou foi vinculada à mão. A Netflix mistura anime com
	 * todo o resto; sem isso, uma série qualquer viraria um anime parecido no AniList.
	 */
	requireListMatch?: boolean;
	/** Chave do episódio/capítulo aberto; `null` quando a página não é de leitura/vídeo. */
	pageKey(url: URL): string | null;
	/** `null` quando a página ainda não carregou o que precisa; o runner tenta de novo. */
	detect(url: URL, doc: Document): Promise<DetectedPage | null>;
	/** Página da obra (sem capítulo/episódio): o popup mostra a obra quando aberto nela. */
	overview?(url: URL, doc: Document): Promise<CurrentPage | null>;
};

export function pathParts(url: URL): string[] {
	return url.pathname.split('/').filter(Boolean);
}

/** `chainsaw-man` → `chainsaw man`, para usar como título quando a página não tem um. */
export function humanizeSlug(slug: string): string {
	return decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** `11`, `11.5`, `Capítulo 11` → 11. Capítulo extra (`.5`) conta como o inteiro de baixo. */
export function parseProgress(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const match = /\d+(?:[.,]\d+)?/.exec(String(value));
	if (!match) return null;
	const number = Math.floor(Number(match[0].replace(',', '.')));
	return Number.isFinite(number) && number > 0 ? number : null;
}
