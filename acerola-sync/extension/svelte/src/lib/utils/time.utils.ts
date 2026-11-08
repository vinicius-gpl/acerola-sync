// O server guarda tudo em UTC. A tela mostra no horário de São Paulo (UTC−3, sem horário de
// verão desde 2019 — o mesmo offset fixo de `server/src/core/services/clock.rs`).

export const DISPLAY_TIME_ZONE = 'America/Sao_Paulo';
const SAO_PAULO_OFFSET_MINUTES = -3 * 60;
const MINUTES_PER_DAY = 24 * 60;

function parseClock(value: string): number | null {
	const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

function formatClock(totalMinutes: number, withSeconds: boolean): string {
	const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
	const minutes = String(normalized % 60).padStart(2, '0');
	return withSeconds ? `${hours}:${minutes}:00` : `${hours}:${minutes}`;
}

/** `09:00` em São Paulo → `12:00:00` em UTC (formato que o server espera). */
export function saoPauloToUtc(value: string): string | null {
	const minutes = parseClock(value);
	if (minutes === null) return null;
	return formatClock(minutes - SAO_PAULO_OFFSET_MINUTES, true);
}

/** `12:00:00` em UTC → `09:00` em São Paulo. */
export function utcToSaoPaulo(value: string): string | null {
	const minutes = parseClock(value);
	if (minutes === null) return null;
	return formatClock(minutes + SAO_PAULO_OFFSET_MINUTES, false);
}

/** `12:00:00` → `12:00`. */
export function shortUtc(value: string): string {
	const minutes = parseClock(value);
	return minutes === null ? value : formatClock(minutes, false);
}

export function formatDateTime(iso: string | null | undefined, locale = 'pt-BR'): string {
	if (!iso) return '';
	return new Intl.DateTimeFormat(locale, {
		timeZone: DISPLAY_TIME_ZONE,
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

/** Tempo até o próximo episódio, curto: `2d 4h`, `3h 10m`, `45m`. */
export function countdown(iso: string | null | undefined, now = Date.now()): string | null {
	if (!iso) return null;
	const diffMinutes = Math.floor((new Date(iso).getTime() - now) / 60_000);
	if (diffMinutes <= 0) return null;

	const days = Math.floor(diffMinutes / MINUTES_PER_DAY);
	const hours = Math.floor((diffMinutes % MINUTES_PER_DAY) / 60);
	const minutes = diffMinutes % 60;
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}
