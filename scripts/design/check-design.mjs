#!/usr/bin/env node
// Acerola design guard: rejects color, shape and font that escape the tokens.
// Ported from acerola-sync (scripts/design/check-design.mjs) and usable by any project: folders
// and exemptions live in acerola.config.json at the repository root.
//
//   node scripts/design/check-design.mjs              → scans the design.scan folders
//   node scripts/design/check-design.mjs a.svelte     → only these files
//   node scripts/design/check-design.mjs --hook       → Claude Code PostToolUse hook: reads the tool
//                                                       JSON from stdin, checks only the edited
//                                                       file and exits 2 on violation
//   node scripts/design/check-design.mjs --summary    → SessionStart hook: prints the rules
//
// Source of truth: .claude/skills/acerola-design/SKILL.md.
// A line containing `design-allow: <reason>` (in a comment) is skipped. Use rarely, with a reason.
// Messages printed to the terminal stay in Portuguese: people read them.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = join(ROOT, 'acerola.config.json');
const config = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {};
const SCAN_DIRS = (config.design?.scan ?? ['src']).map((dir) => join(ROOT, dir));
const EXTENSIONS = config.design?.extensions ?? ['.svelte', '.ts', '.css', '.html'];
const EXEMPT = (config.design?.exempt ?? ['/theme/', '\\.test\\.ts$', '\\.d\\.ts$']).map(
	(pattern) => new RegExp(pattern)
);

const PALETTE =
	'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';
const COLOR_UTILITIES =
	'bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder';
const THEME_COLORS =
	'primary|secondary|destructive|success|warning|info|accent|accent-hero|chart-\\d|ring|foreground|muted-foreground';

export const RULES = [
	{
		id: 'hex-color',
		message: 'cor em hex: use um token do tema (bg-primary, var(--success)…)',
		pattern: /(^|[\s'"`(:,[=])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/
	},
	{
		id: 'color-function',
		message: 'cor por função (rgb/hsl/oklch): use um token do tema',
		pattern: /\b(?:rgba?|hsla?|oklch|oklab)\(/
	},
	{
		id: 'tailwind-palette',
		message: 'cor da paleta padrão do Tailwind: use um token (scrim/on-scrim sobre capa)',
		pattern: new RegExp(
			`\\b(?:${COLOR_UTILITIES})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?(?![\\w-])`
		)
	},
	{
		id: 'arbitrary-color',
		message: 'cor arbitrária em classe: use um token do tema',
		pattern: new RegExp(`\\b(?:${COLOR_UTILITIES})-\\[(?:#|rgb|hsl|oklch|color:)`)
	},
	{
		id: 'colored-border',
		message: 'borda colorida é proibida: o estado vai na cor de fundo (*-soft) ou num ponto',
		pattern: new RegExp(
			`\\bborder(?:-[trblxyse])?-(?:${THEME_COLORS})(?![\\w-])|\\bborder-[trbl]-(?:[2-9]|\\[)|border-(?:left|right|top|bottom)\\s*:`
		)
	},
	{
		id: 'radius',
		message: 'raio fora do token: use rounded-sheet | card | tile | inner | full',
		pattern:
			/\brounded(?:-(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|\[[^\]]*\])(?![\w-])|\brounded(?=["'`\s])/
	},
	{
		id: 'shadow',
		message: 'sombra fora do token: use shadow-lift | shadow-float',
		pattern: /\bshadow-(?:xs|sm|md|lg|xl|2xl|inner|\[[^\]]*\])(?![\w-])/
	},
	{
		id: 'font',
		message: 'fonte fora do token: use font-sans | font-heading | font-display (só marca)',
		pattern: /\bfont-\[|\bfont-family\s*:(?!\s*var\(--font-)/
	},
	{
		id: 'display-in-control',
		message: 'Titan One (font-display) só na marca: nunca em botão, aba, campo ou lista',
		pattern:
			/<(?:button|input|select|textarea|li)\b[^>]*\bfont-display\b|\bfont-display\b[^"'`]*\bac-(?:btn|chip|input|pill-nav)/
	},
	{
		id: 'important',
		message: '!important foge da cascata dos tokens: resolva pela especificidade',
		pattern: /!important/
	}
];

export function isExempt(path) {
	const normalized = path.split(sep).join('/');
	return EXEMPT.some((pattern) => pattern.test(normalized));
}

/** Problems in a source text: `[{ line, rule, message, excerpt }]`. */
export function checkSource(source) {
	const problems = [];
	source.split('\n').forEach((text, index) => {
		if (text.includes('design-allow')) return;
		for (const rule of RULES) {
			const match = rule.pattern.exec(text);
			if (match) {
				problems.push({ line: index + 1, rule: rule.id, message: rule.message, excerpt: match[0].trim() });
			}
		}
	});
	return problems;
}

function walk(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (name === 'node_modules' || name.startsWith('.')) return [];
		if (statSync(path).isDirectory()) return walk(path);
		return EXTENSIONS.some((ext) => path.endsWith(ext)) ? [path] : [];
	});
}

export function checkFiles(paths) {
	const report = [];
	for (const path of paths) {
		if (isExempt(path) || !EXTENSIONS.some((ext) => path.endsWith(ext))) continue;
		for (const problem of checkSource(readFileSync(path, 'utf8'))) {
			report.push({ file: relative(ROOT, path), ...problem });
		}
	}
	return report;
}

function format(report) {
	return report
		.map((p) => `${p.file}:${p.line}  [${p.rule}] ${p.message}  →  ${p.excerpt}`)
		.join('\n');
}

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

const SUMMARY = `Design Acerola (skill acerola-design) — regras que o hook confere:
- Cor só por token (bg-primary, text-success, var(--x)). Nada de hex, rgb/hsl, paleta do Tailwind, preto/branco.
- Raio só por token: rounded-sheet | card | tile | inner | full. Sombra: shadow-lift | shadow-float.
- Nenhuma borda colorida: estado no fundo (*-soft) ou num ponto.
- Fonte: font-sans (DM Sans, tudo), font-heading (Noto Serif), font-display (Titan One, só marca).
- Uma ação primária por tela. Telas com estado vazio, carregando e erro. Claro e escuro.
Exceção só com "design-allow: <motivo>" na linha.`;

async function main() {
	const args = process.argv.slice(2);

	if (args[0] === '--summary') {
		console.log(SUMMARY);
		return;
	}

	if (args[0] === '--hook') {
		let filePath;
		try {
			filePath = JSON.parse(await readStdin())?.tool_input?.file_path;
		} catch {
			filePath = undefined;
		}
		if (!filePath || !SCAN_DIRS.some((dir) => resolve(filePath).startsWith(dir))) return;
		const report = checkFiles([resolve(filePath)]);
		if (report.length) {
			console.error(`O arquivo fugiu do design Acerola (skill acerola-design):\n${format(report)}`);
			process.exit(2);
		}
		return;
	}

	// Explicit files (lefthook passes the staged ones) are filtered by design.scan too: the token
	// sources (tokens.css and friends) live outside it and are where raw colors belong.
	const inScan = (path) => SCAN_DIRS.some((dir) => path.startsWith(dir));
	const files = args.length ? args.map((arg) => resolve(ROOT, arg)).filter(inScan) : SCAN_DIRS.flatMap(walk);
	const report = checkFiles(files);
	if (report.length) {
		console.error(format(report));
		console.error(`\n${report.length} problema(s) de design.`);
		process.exit(1);
	}
	console.log('Design ok.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
