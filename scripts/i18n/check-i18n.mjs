#!/usr/bin/env node
// Acerola i18n guard for message files (Paraglide / inlang message format, messages/{locale}.json).
//
//   node scripts/i18n/check-i18n.mjs            → checks every folder in i18n.messages
//   node scripts/i18n/check-i18n.mjs --hook     → Claude Code PostToolUse hook (exits 2 on violation)
//
// Rules (source of truth: .claude/skills/acerola-project/SKILL.md, "i18n"):
// - keys are English and nested by subject: `search.placeholder`, never `search_placeholder`;
//   a segment never uses `_` or `-` to glue two contexts (one word, or camelCase for a compound noun);
// - every locale has exactly the keys of the base locale;
// - every value is a non-empty string.
// Messages printed to the terminal stay in Portuguese: people read them.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = join(ROOT, 'acerola.config.json');
const config = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {};
const FOLDERS = (config.i18n?.messages ?? ['messages']).map((dir) => join(ROOT, dir));
const BASE = config.i18n?.baseLocale ?? 'pt-br';

const SEGMENT = /^[a-z][a-zA-Z0-9]*$/;

/** Flattens a nested message object into `[path, value]` pairs. */
export function flatten(node, prefix = []) {
	return Object.entries(node).flatMap(([key, value]) => {
		if (key === '$schema') return [];
		const path = [...prefix, key];
		return value && typeof value === 'object' ? flatten(value, path) : [[path, value]];
	});
}

/** Problems in one folder of locale files: `[{ file, key, message }]`. */
export function checkFolder(folder) {
	const files = readdirSync(folder).filter((name) => name.endsWith('.json'));
	const locales = Object.fromEntries(
		files.map((name) => [basename(name, '.json'), JSON.parse(readFileSync(join(folder, name), 'utf8'))])
	);
	const problems = [];

	for (const [locale, messages] of Object.entries(locales)) {
		for (const [path, value] of flatten(messages)) {
			const bad = path.find((segment) => !SEGMENT.test(segment));
			if (bad)
				problems.push({
					file: `${locale}.json`,
					key: path.join('.'),
					message: `segmento "${bad}" fora do padrão: inglês, uma palavra ou camelCase, sem _ ou - (use mais um nível)`
				});
			if (typeof value !== 'string' || !value.trim())
				problems.push({ file: `${locale}.json`, key: path.join('.'), message: 'valor vazio ou não é texto' });
		}
	}

	const base = locales[BASE];
	if (!base) return [...problems, { file: `${BASE}.json`, key: '-', message: 'idioma base não encontrado' }];
	const baseKeys = new Set(flatten(base).map(([path]) => path.join('.')));
	for (const [locale, messages] of Object.entries(locales)) {
		if (locale === BASE) continue;
		const keys = new Set(flatten(messages).map(([path]) => path.join('.')));
		for (const key of baseKeys)
			if (!keys.has(key)) problems.push({ file: `${locale}.json`, key, message: `falta (existe em ${BASE})` });
		for (const key of keys)
			if (!baseKeys.has(key)) problems.push({ file: `${locale}.json`, key, message: `sobra (não existe em ${BASE})` });
	}
	return problems.map((problem) => ({ ...problem, file: relative(ROOT, join(folder, problem.file)) }));
}

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

async function main() {
	let folders = FOLDERS.filter((folder) => existsSync(folder));

	if (process.argv[2] === '--hook') {
		let filePath;
		try {
			filePath = resolve(JSON.parse(await readStdin())?.tool_input?.file_path ?? '');
		} catch {
			return;
		}
		folders = folders.filter((folder) => filePath.startsWith(folder));
		if (!folders.length) return;
	}

	const problems = folders.flatMap(checkFolder);
	if (problems.length) {
		const text = problems.map((p) => `${p.file}  ${p.key}  →  ${p.message}`).join('\n');
		console.error(`i18n fora do padrão Acerola (skill acerola-project):\n${text}`);
		process.exit(process.argv[2] === '--hook' ? 2 : 1);
	}
	if (process.argv[2] !== '--hook') console.log('i18n ok.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
