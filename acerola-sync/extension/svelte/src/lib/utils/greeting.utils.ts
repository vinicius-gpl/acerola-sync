import { DISPLAY_TIME_ZONE } from './time.utils';

export type DayPeriod = 'morning' | 'afternoon' | 'night';

/** Time of day in Brasília time, for the greeting at the top. */
export function dayPeriod(now = new Date()): DayPeriod {
	const hour = Number(
		new Intl.DateTimeFormat('en-US', {
			timeZone: DISPLAY_TIME_ZONE,
			hour: 'numeric',
			hourCycle: 'h23'
		}).format(now)
	);
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 18) return 'afternoon';
	return 'night';
}

/** `5 min`, `2 h`, `3 d`: short and the same in both languages, for the last sync. */
export function relativeAge(iso: string | null | undefined, now = Date.now()): string | null {
	if (!iso) return null;
	const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
	if (minutes < 1) return '<1 min';
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} h`;
	return `${Math.floor(hours / 24)} d`;
}
