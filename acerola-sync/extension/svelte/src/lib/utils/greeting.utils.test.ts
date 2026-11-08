import { describe, expect, it } from 'vitest';
import { dayPeriod, relativeAge } from './greeting.utils';

describe('greeting.utils', () => {
	it('usa o horário de Brasília', () => {
		// 13:00 UTC = 10:00 em Brasília.
		expect(dayPeriod(new Date('2026-11-07T13:00:00Z'))).toBe('morning');
		expect(dayPeriod(new Date('2026-11-07T18:00:00Z'))).toBe('afternoon');
		expect(dayPeriod(new Date('2026-11-08T02:00:00Z'))).toBe('night');
	});

	it('resume a idade', () => {
		const now = Date.parse('2026-11-07T12:00:00Z');
		expect(relativeAge('2026-11-07T11:59:40Z', now)).toBe('<1 min');
		expect(relativeAge('2026-11-07T11:55:00Z', now)).toBe('5 min');
		expect(relativeAge('2026-11-07T09:00:00Z', now)).toBe('3 h');
		expect(relativeAge('2026-11-04T12:00:00Z', now)).toBe('3 d');
		expect(relativeAge(null, now)).toBeNull();
	});
});
