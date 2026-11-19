#!/usr/bin/env node
// Checks the commit message against the Acerola format: [type](scope): Message
//
//   node scripts/git/commit-msg.mjs .git/COMMIT_EDITMSG     (lefthook passes the file)
//
// Valid scopes come from acerola.config.json (commit.scopes); types are the same in every project.
// Replaces acerola-sync's commitlint and acerola-reader's grep with a single dependency-free rule
// that runs the same in Rust, Android or Node projects.
// Messages printed to the terminal stay in Portuguese: people read them.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const TYPES = [
	'feat',
	'fix',
	'refactor',
	'test',
	'docs',
	'style',
	'perf',
	'build',
	'ci',
	'chore',
	'merge'
];

/** Errors in the message (empty list = ok). */
export function checkMessage(message, scopes) {
	const header = message
		.split('\n')
		.find((line) => line.trim() && !line.startsWith('#'))
		?.trim();
	if (!header) return ['mensagem vazia'];

	const match = /^\[(\w+)\]\(([a-z0-9-]+)\): (.+)$/.exec(header);
	if (!match) return [`formato inválido: "${header}". Use [tipo](local): Mensagem`];

	const [, type, scope, subject] = match;
	const errors = [];
	if (!TYPES.includes(type)) errors.push(`tipo "${type}" não existe. Use: ${TYPES.join(', ')}`);
	if (scopes.length && !scopes.includes(scope))
		errors.push(`local "${scope}" não existe neste projeto. Use: ${scopes.join(', ')}`);
	if (subject.endsWith('.')) errors.push('a mensagem não termina com ponto');
	if (subject[0] !== subject[0].toUpperCase()) errors.push('a mensagem começa com letra maiúscula');
	if (header.length > 100) errors.push(`cabeçalho com ${header.length} caracteres (máximo 100)`);
	return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const file = process.argv[2];
	if (!file) {
		console.error('uso: node scripts/git/commit-msg.mjs <arquivo da mensagem>');
		process.exit(1);
	}
	let scopes = [];
	try {
		const config = JSON.parse(readFileSync(join(ROOT, 'acerola.config.json'), 'utf8'));
		scopes = Object.keys(config.commit?.scopes ?? {});
	} catch {
		// no acerola.config.json: check only the format and the type
	}
	const errors = checkMessage(readFileSync(file, 'utf8'), scopes);
	if (errors.length) {
		console.error('\n  ✋ Mensagem de commit fora do padrão Acerola:\n');
		for (const error of errors) console.error(`   - ${error}`);
		console.error('\n  Formato: [tipo](local): Mensagem   ex.: [feat](site): Hero em Titan One com GSAP\n');
		process.exit(1);
	}
}
