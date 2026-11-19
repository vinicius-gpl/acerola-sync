#!/usr/bin/env node
// Bumps an app's version from its release tag (`extension/v1.2.3` → 1.2.3).
//
//   node scripts/release/bump.mjs extension 1.2.3
//   node scripts/release/bump.mjs server 1.2.3
//   node scripts/release/bump.mjs --tag extension/v1.2.3   (prints PRERELEASE=… and VERSION=…)
//
// Extension: `acerola-sync/extension/package.json` (WXT reads the manifest version from it).
// Server: `acerola-sync/server/Cargo.toml` and the package's own entry in `Cargo.lock`.
// A pre-release tag (`extension/v1.5.0-rc.1`) builds and publishes a pre-release on GitHub.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'acerola-sync');
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-rc\.[1-9]\d*)?$/;

/** `extension/v1.2.3-rc.1` → `{ app: 'extension', version: '1.2.3-rc.1', prerelease: true }`. */
export function parseTag(tag) {
	const match = /^(extension|server)\/v(.+)$/.exec(tag);
	if (!match || !SEMVER.test(match[2])) throw new Error(`Tag inválida: ${tag}`);
	return { app: match[1], version: match[2], prerelease: match[2].includes('-') };
}

export function bumpPackageJson(text, version) {
	const pkg = JSON.parse(text);
	pkg.version = version;
	const indent = /^\{\n(\s+)"/.exec(text)?.[1] ?? '\t';
	return JSON.stringify(pkg, null, indent) + '\n';
}

/** The [package] section span (up to the next line that opens a section). */
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
	// Only the [package] `version`, never a dependency's (and `authors = [...]` does not cut the
	// section short).
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

/** Changed files, relative to the workspace root. */
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
		// For the workflow's `$GITHUB_ENV`: `PRERELEASE=false` and `VERSION=1.2.3`.
		const { prerelease, version } = parseTag(second);
		console.log(`PRERELEASE=${prerelease}\nVERSION=${version}`);
	} else {
		for (const path of bump(first, second)) console.log(`${path} → ${second}`);
	}
}
