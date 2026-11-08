#!/usr/bin/env node
// Sobe a versão de um app a partir da tag de release (`extension/prod/v1.2.3` → 1.2.3).
//
//   node scripts/release/bump.mjs extension 1.2.3
//   node scripts/release/bump.mjs server 1.2.3
//   node scripts/release/bump.mjs --tag extension/prod/v1.2.3   (CHANNEL=… e VERSION=…)
//
// Extensão: `extension/package.json` (o WXT tira a versão do manifest dali).
// Server: `server/Cargo.toml` e a entrada do próprio pacote no `server/Cargo.lock`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** `extension/beta/v1.2.3` → `{ app: 'extension', channel: 'beta', version: '1.2.3' }`. */
export function parseTag(tag) {
	const match = /^(extension|server)\/(alpha|beta|prod)\/v(.+)$/.exec(tag);
	if (!match || !SEMVER.test(match[3])) throw new Error(`Tag inválida: ${tag}`);
	return { app: match[1], channel: match[2], version: match[3] };
}

export function bumpPackageJson(text, version) {
	const pkg = JSON.parse(text);
	pkg.version = version;
	const indent = /^\{\n(\s+)"/.exec(text)?.[1] ?? '\t';
	return JSON.stringify(pkg, null, indent) + '\n';
}

/** Trecho da seção [package] (até a próxima linha que abre seção). */
function packageSection(text) {
	const start = text.indexOf('[package]');
	if (start < 0) throw new Error('Cargo.toml sem [package]');
	const next = text.slice(start + 1).search(/^\[/m);
	return { start, end: next < 0 ? text.length : start + 1 + next };
}

export function cargoPackageName(text) {
	const { start, end } = packageSection(text);
	return /^name\s*=\s*"([^"]+)"/m.exec(text.slice(start, end))?.[1];
}

export function bumpCargoToml(text, version) {
	// Só o `version` da seção [package], não o das dependências (e `authors = [...]` não corta
	// a seção no meio).
	const { start, end } = packageSection(text);
	const section = text
		.slice(start, end)
		.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
	return text.slice(0, start) + section + text.slice(end);
}

export function bumpCargoLock(text, name, version) {
	return text.replace(
		new RegExp(`(\\[\\[package\\]\\]\\nname = "${name}"\\nversion = ")[^"]*(")`),
		(_, before, after) => `${before}${version}${after}`
	);
}

/** Arquivos alterados, relativos à raiz do workspace. */
export function bump(app, version, root = ROOT) {
	if (!SEMVER.test(version)) throw new Error(`Versão inválida: ${version}`);
	const edit = (path, change) => {
		const file = join(root, path);
		writeFileSync(file, change(readFileSync(file, 'utf8')));
		return path;
	};
	if (app === 'extension') {
		return [edit('extension/package.json', (text) => bumpPackageJson(text, version))];
	}
	if (app === 'server') {
		const name = cargoPackageName(readFileSync(join(root, 'server/Cargo.toml'), 'utf8'));
		return [
			edit('server/Cargo.toml', (text) => bumpCargoToml(text, version)),
			edit('server/Cargo.lock', (text) => bumpCargoLock(text, name, version))
		];
	}
	throw new Error(`App desconhecido: ${app}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [first, second] = process.argv.slice(2);
	if (first === '--tag') {
		// Para o `$GITHUB_ENV` do workflow: `CHANNEL=prod` e `VERSION=1.2.3`.
		const { channel, version } = parseTag(second);
		console.log(`CHANNEL=${channel}\nVERSION=${version}`);
	} else {
		for (const path of bump(first, second)) console.log(`${path} → ${second}`);
	}
}
