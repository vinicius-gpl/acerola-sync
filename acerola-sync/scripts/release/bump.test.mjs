import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bump, bumpCargoLock, bumpCargoToml, bumpPackageJson, parseTag } from './bump.mjs';

test('lê app, canal e versão da tag', () => {
	assert.deepEqual(parseTag('extension/prod/v1.2.3'), {
		app: 'extension',
		channel: 'prod',
		version: '1.2.3'
	});
	assert.equal(parseTag('server/beta/v0.2.0-rc.1').version, '0.2.0-rc.1');
	assert.throws(() => parseTag('desktop/prod/v1.0.0'));
	assert.throws(() => parseTag('server/prod/vabc'));
});

test('package.json mantém a indentação', () => {
	const out = bumpPackageJson('{\n\t"name": "x",\n\t"version": "0.1.0"\n}\n', '1.0.0');
	assert.equal(out, '{\n\t"name": "x",\n\t"version": "1.0.0"\n}\n');
});

test('Cargo.toml muda só a versão do pacote, não a das dependências', () => {
	const toml = '[package]\nauthors = ["Vinícius"]\nname = "acerola-sync"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1" }\nfoo = "0.1.0"\n';
	const out = bumpCargoToml(toml, '2.3.4');
	assert.match(out, /name = "acerola-sync"\nversion = "2\.3\.4"/);
	assert.match(out, /serde = \{ version = "1" \}/);
	assert.match(out, /foo = "0\.1\.0"/);
});

test('Cargo.lock muda só a entrada do próprio pacote', () => {
	const lock = '[[package]]\nname = "acerola-sync"\nversion = "0.1.0"\n\n[[package]]\nname = "axum"\nversion = "0.1.0"\n';
	const out = bumpCargoLock(lock, 'acerola-sync', '2.0.0');
	assert.match(out, /name = "acerola-sync"\nversion = "2\.0\.0"/);
	assert.match(out, /name = "axum"\nversion = "0\.1\.0"/);
});

test('bump escreve os arquivos de cada app', () => {
	const root = mkdtempSync(join(tmpdir(), 'acerola-bump-'));
	mkdirSync(join(root, 'extension'));
	mkdirSync(join(root, 'server'));
	writeFileSync(join(root, 'extension/package.json'), '{\n\t"version": "0.1.0"\n}\n');
	writeFileSync(join(root, 'server/Cargo.toml'), '[package]\nname = "acerola-sync"\nversion = "0.1.0"\n');
	writeFileSync(join(root, 'server/Cargo.lock'), '[[package]]\nname = "acerola-sync"\nversion = "0.1.0"\n');

	assert.deepEqual(bump('extension', '1.1.0', root), ['extension/package.json']);
	assert.match(readFileSync(join(root, 'extension/package.json'), 'utf8'), /"1\.1\.0"/);
	bump('server', '0.3.0', root);
	assert.match(readFileSync(join(root, 'server/Cargo.toml'), 'utf8'), /version = "0\.3\.0"/);
	assert.match(readFileSync(join(root, 'server/Cargo.lock'), 'utf8'), /version = "0\.3\.0"/);
	assert.throws(() => bump('server', 'x', root));
});
