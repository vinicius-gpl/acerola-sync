// Gera a capa do README (docs/github/ptbr/hero.jpg) a partir do hero.html, em 1920x1080.
//
//   node docs/github/source/render-hero.mjs
//
// Usa o Playwright do workspace da extensão (Chromium sem janela).
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../acerola-sync/extension/package.json'));
const { chromium } = require('@playwright/test');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(here, 'hero.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(here, '../ptbr/hero.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
console.log('docs/github/ptbr/hero.jpg');
