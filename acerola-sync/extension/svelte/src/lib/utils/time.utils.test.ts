import { describe, expect, it } from 'vitest';
import { countdown, saoPauloToUtc, shortUtc, utcToSaoPaulo } from './time.utils';

describe('time.utils', () => {
	it('converte o horário de São Paulo para UTC e de volta', () => {
		expect(saoPauloToUtc('09:00')).toBe('12:00:00');
		expect(saoPauloToUtc('22:30')).toBe('01:30:00');
		expect(utcToSaoPaulo('12:00:00')).toBe('09:00');
		expect(utcToSaoPaulo('01:30:00')).toBe('22:30');
	});

	it('recusa horário inválido', () => {
		expect(saoPauloToUtc('24:00')).toBeNull();
		expect(saoPauloToUtc('9h')).toBeNull();
	});

	it('encurta o horário UTC', () => {
		expect(shortUtc('12:00:00')).toBe('12:00');
	});

	it('mostra a contagem até o próximo episódio', () => {
		const now = Date.parse('2026-11-07T12:00:00Z');
		expect(countdown('2026-11-09T16:00:00Z', now)).toBe('2d 4h');
		expect(countdown('2026-11-07T15:10:00Z', now)).toBe('3h 10m');
		expect(countdown('2026-11-07T12:45:00Z', now)).toBe('45m');
		expect(countdown('2026-11-07T11:00:00Z', now)).toBeNull();
		expect(countdown(null, now)).toBeNull();
	});
});
