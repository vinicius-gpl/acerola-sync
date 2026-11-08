#!/usr/bin/env node
// Guarda do design do Acerola Sync: recusa cor e forma que fujam dos tokens.
//
//   node scripts/design/check-design.mjs            → varre extension/svelte/src
//   node scripts/design/check-design.mjs a.svelte   → só esses arquivos
//   node scripts/design/check-design.mjs --hook     → hook do Claude Code: lê o JSON da
//                                                      ferramenta no stdin e confere só o
//                                                      arquivo editado; sai com 2
//
// Regras (a fonte de verdade é a skill `.claude/skills/acerola-design/SKILL.md`):
//   - cor só por token do tema (`bg-primary`, `text-success`…): nada de hex, rgb(), hsl(),
//     paleta padrão do Tailwind (`bg-emerald-500`, `text-white`) nem cor arbitrária `bg-[#…]`;
//   - nenhuma borda colorida (`border-primary`, faixa `border-l-4`…);
//   - raio só por token: `rounded-sheet | card | tile | inner | full`.
// Linha com `design-allow` (comentário) é ignorada — use com motivo escrito do lado.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN_DIR = join(ROOT, 'extension/svelte/src');
const EXTENSIONS = ['.svelte', '.ts', '.css'];

/// Fora da regra: o tema (onde as cores nascem), o shadcn vendorizado, o i18n gerado, testes
/// e os componentes copiados do acerola-reader (seguem o design de lá).
const EXEMPT = [
	/\/theme\//,
	/\/lib\/components\/ui\//,
	/\/lib\/paraglide\//,
	/\.test\.ts$/,
	/\.d\.ts$/,
	/\/lib\/components\/acerola-(accordion-card|alert-dialog|button|card|command|dialog|hero-button|input|mode-picker|notification|popover|select|settings-header|sonner|switch|toggle-card|toggle-group)\//
];

const PALETTE =
	'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';
const COLOR_UTILITIES =
	'bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder';
const THEME_COLORS =
	'primary|secondary|destructive|success|warning|info|accent|accent-hero|chart-\\d|ring|foreground|muted-foreground';

export const RULES = [
	{
		id: 'hex-color',
		message: 'cor em hex: use um token do tema (bg-primary, text-success…)',
		pattern: /(^|[\s'"`(:,[=])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/
	},
	{
		id: 'color-function',
		message: 'cor por função (rgb/hsl/oklch): use um token do tema',
		pattern: /\b(?:rgba?|hsla?|oklch|oklab)\(/
	},
	{
		id: 'tailwind-palette',
		message: 'cor da paleta padrão do Tailwind: use um token (scrim/on-scrim para sobre capa)',
		pattern: new RegExp(`\\b(?:${COLOR_UTILITIES})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?(?![\\w-])`)
	},
	{
		id: 'arbitrary-color',
		message: 'cor arbitrária em classe: use um token do tema',
		pattern: new RegExp(`\\b(?:${COLOR_UTILITIES})-\\[(?:#|rgb|hsl|oklch|color:|var\\()`)
	},
	{
		id: 'colored-border',
		message: 'borda colorida é proibida: o estado vai na cor de fundo ou num ponto',
		pattern: new RegExp(`\\bborder(?:-[trblxyse])?-(?:${THEME_COLORS})(?![\\w-])|\\bborder-[trbl]-(?:[2-9]|\\[)|border-(?:left|right|top|bottom)\\s*:`)
	},
	{
		id: 'radius',
		message: 'raio fora do token: use rounded-sheet | card | tile | inner | full',
		pattern: /\brounded(?:-(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|\[[^\]]*\])(?![\w-])|\brounded(?=["'`\s])/
	}
];

export function isExempt(path) {
	const normalized = path.split(sep).join('/');
	return EXEMPT.some((pattern) => pattern.test(normalized));
}

/** Problemas de um texto: `[{ line, rule, message, excerpt }]`. */
export function checkSource(source) {
	const problems = [];
	source.split('\n').forEach((text, index) => {
		if (text.includes('design-allow')) return;
		for (const rule of RULES) {
			const match = rule.pattern.exec(text);
			if (match) {
				problems.push({
					line: index + 1,
					rule: rule.id,
					message: rule.message,
					excerpt: match[0].trim()
				});
			}
		}
	});
	return problems;
}

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
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

async function main() {
	const args = process.argv.slice(2);
	const hook = args[0] === '--hook';
	if (args.length && !hook) {
		const report = checkFiles(args.map((arg) => resolve(arg)));
		if (report.length) {
			console.error(format(report));
			process.exit(1);
		}
		return;
	}

	// Hook do Claude Code: recebe o JSON da ferramenta e confere só o arquivo editado.
	if (hook) {
		const input = await readStdin();
		let filePath;
		try {
			filePath = JSON.parse(input)?.tool_input?.file_path;
		} catch {
			filePath = undefined;
		}
		if (!filePath || !resolve(filePath).startsWith(SCAN_DIR)) return;
		const report = checkFiles([resolve(filePath)]);
		if (report.length) {
			console.error(
				`O arquivo fugiu do design do Acerola (skill acerola-design):\n${format(report)}`
			);
			process.exit(2);
		}
		return;
	}

	const report = checkFiles(walk(SCAN_DIR));
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
