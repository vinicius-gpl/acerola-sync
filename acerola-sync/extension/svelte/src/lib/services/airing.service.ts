import type { EntryWithMedia, Media } from '$lib/api/types';

// Avisos de episódio novo. O server mantém o próximo episódio de cada anime em lançamento
// (sync automático de hora em hora); o background da extensão confere de tempos em tempos e
// avisa pelo sistema o que saiu desde a última olhada, e põe no ícone quantas obras têm
// episódio novo esperando.

/** Último episódio já lançado de um anime em lançamento; `null` quando não dá para saber. */
export function latestAired(media: Pick<Media, 'nextAiringEpisode' | 'nextAiringAt'>, now: number) {
	if (!media.nextAiringEpisode) return null;
	const airsAt = media.nextAiringAt ? Date.parse(media.nextAiringAt) : NaN;
	// O próximo já passou da hora (o espelho só atualiza no próximo sync): ele também saiu.
	const aired = airsAt <= now ? media.nextAiringEpisode : media.nextAiringEpisode - 1;
	return aired > 0 ? aired : null;
}

export type NewEpisode = { mediaId: number; title: string; episode: number; cover: string | null };

export type AiringCheck = {
	/** Obras com episódio lançado além do progresso (o número no ícone). */
	behind: number;
	/** Episódios que saíram desde a última conferência (viram notificação). */
	fresh: NewEpisode[];
	/** Último episódio visto por obra, para a próxima conferência. */
	seen: Record<string, number>;
};

/**
 * Compara o que saiu com o que já foi visto. Obra vista pela primeira vez só entra na base, sem
 * aviso: senão a primeira conferência avisaria de toda a lista atrasada de uma vez.
 */
export function checkAiring(
	entries: EntryWithMedia[],
	seen: Record<string, number>,
	now: number
): AiringCheck {
	const next: Record<string, number> = {};
	const fresh: NewEpisode[] = [];
	let behind = 0;

	for (const entry of entries) {
		if (entry.media.mediaType !== 'ANIME') continue;
		const aired = latestAired(entry.media, now);
		if (!aired) continue;
		if (aired > entry.progress) behind++;

		const key = String(entry.mediaId);
		const before = seen[key];
		next[key] = Math.max(aired, before ?? 0);
		if (before !== undefined && aired > before && aired > entry.progress) {
			fresh.push({
				mediaId: entry.mediaId,
				title: entry.media.titleUserPreferred,
				episode: aired,
				cover: entry.media.coverUrl
			});
		}
	}
	return { behind, fresh, seen: next };
}
