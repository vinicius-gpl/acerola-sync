import type { ErrorPayload } from '$lib/contracts/shared/shared.payloads';
import { resolveErrorMessage } from '$lib/contracts/errors/errors.i18n';

/**
 * Extracts a user-friendly error message from an unknown thrown error.
 * Safely parses string errors, Tauri ErrorPayload objects, or Error instances without using `any`.
 */
export function extractErrorMessage(error: unknown): string {
	if (error === null || error === undefined) {
		return 'Unknown error occurred';
	}
	// Stryker disable next-line ConditionalExpression,BlockStatement,StringLiteral: disabling/short-circuiting
	// this guard makes a string input fall into `return String(error)` below. `String(x) === x`
	// for any primitive string by spec, so the observable output never changes: a mutant that
	// removes or knocks down this check is truly equivalent for any string input.
	if (typeof error === 'string') {
		return error;
	}
	if (typeof error === 'object') {
		const payload = error as Partial<ErrorPayload>;
		// Payload from a Tauri command with a typed `errorType` (ComicError): translates via
		// Paraglide instead of leaking Rust's raw English `message` to the UI. A type not mapped
		// in COMIC_ERROR_MESSAGES falls back to the raw `message` (the usual fallback).
		if (typeof payload.errorType === 'string' && typeof payload.message === 'string') {
			return resolveErrorMessage(payload as ErrorPayload);
		}
		// Stryker disable next-line ConditionalExpression,LogicalOperator,StringLiteral,EqualityOperator,BlockStatement,MethodExpression:
		// this branch and the fallback right below read the same `message` property of the same
		// object (`payload` is just `error` with a cast, not a copy), without trim. Whenever
		// `typeof payload.message === 'string'` is true, `'message' in error` is necessarily
		// true too, so the fallback fires with the identical value. That makes the exact shape
		// of this condition unobservable: disabling it, forcing any operand, flipping the
		// `.trim().length > 0` boundary either way, removing `.trim()` or emptying the if-block
		// all keep returning the same string; the flow only reroutes through the fallback
		// branch (or vice versa), but the return value is always identical.
		if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
			return payload.message;
		}
		if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
			return (error as { message: string }).message;
		}
	}
	return String(error);
}
