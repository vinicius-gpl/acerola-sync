import type { EntryWithMedia, Media } from '$lib/api/types';

// New-episode notices. The server keeps the next episode of each airing anime (automatic
// hourly sync); the extension background checks from time to time, notifies through the
// system what aired since the last look, and shows on the icon how many media have a new
// episode waiting.

/** Last aired episode of an airing anime; `null` when there is no way to know. */
export function latestAired(media: Pick<Media, 'nextAiringEpisode' | 'nextAiringAt'>, now: number) {
	if (!media.nextAiringEpisode) return null;
	const airsAt = media.nextAiringAt ? Date.parse(media.nextAiringAt) : NaN;
	// The next one is already past its time (the mirror only updates on the next sync): it aired too.
	const aired = airsAt <= now ? media.nextAiringEpisode : media.nextAiringEpisode - 1;
	return aired > 0 ? aired : null;
}

export type NewEpisode = { mediaId: number; title: string; episode: number; cover: string | null };

export type AiringCheck = {
	/** Media with an aired episode beyond the progress (the number on the icon). */
	behind: number;
	/** Episodes aired since the last check (they become notifications). */
	fresh: NewEpisode[];
	/** Last episode seen per media, for the next check. */
	seen: Record<string, number>;
};

/**
 * Compares what aired with what was already seen. A media seen for the first time only enters
 * the baseline, with no notice: otherwise the first check would notify the whole backlog at once.
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

/** Notice already sent through the system, kept for the notifications screen. */
export type NotificationItem = NewEpisode & {
	/** Same id as the system notification (`airing:{mediaId}:{episode}`). */
	id: string;
	/** When it notified, in ISO (UTC). */
	at: string;
	read: boolean;
};

/** How many notices the screen keeps; the oldest drop out. */
export const NOTIFICATIONS_KEPT = 50;

export function notificationId(episode: Pick<NewEpisode, 'mediaId' | 'episode'>) {
	return `airing:${episode.mediaId}:${episode.episode}`;
}

/** Puts new notices on top, without repeating the same episode, and keeps only the last 50. */
export function addNotifications(
	list: NotificationItem[],
	fresh: NewEpisode[],
	now: number
): NotificationItem[] {
	const at = new Date(now).toISOString();
	const added = fresh.map((episode) => ({
		...episode,
		id: notificationId(episode),
		at,
		read: false
	}));
	const ids = new Set(added.map((item) => item.id));
	return [...added, ...list.filter((item) => !ids.has(item.id))].slice(0, NOTIFICATIONS_KEPT);
}
