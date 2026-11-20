import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/client';
import { errorAction, errorKind, screenError } from './error-screen.utils';

describe('error-screen.utils', () => {
	it('mapeia o status para a variante da tela', () => {
		expect(errorKind(404)).toBe('notFound');
		expect(errorKind(503)).toBe('unavailable');
		expect(errorKind(418)).toBe('badRequest');
		expect(errorKind(599)).toBe('server');
		expect(errorKind(500, false)).toBe('offline');
	});

	it('4xx leva ao início; 5xx e sem conexão tentam de novo', () => {
		expect(errorAction('notFound')).toBe('home');
		expect(errorAction('server')).toBe('retry');
		expect(errorAction('offline')).toBe('retry');
	});

	it('server sem resposta vira 503 com internet e "sem conexão" sem ela', () => {
		const down = new ApiError(0, 'network', 'Failed to fetch');
		expect(screenError(down, true)).toEqual({ status: 503, kind: 'unavailable' });
		expect(screenError(down, false)).toEqual({ status: 0, kind: 'offline' });
		expect(screenError(new ApiError(404, 'not_found', 'x'))).toEqual({
			status: 404,
			kind: 'notFound'
		});
		expect(screenError(new Error('boom'))).toEqual({ status: 500, kind: 'unknown' });
	});
});
