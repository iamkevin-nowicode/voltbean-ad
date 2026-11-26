// Grab stills at given times:  node tools/shots.mjs out_dir 0 2.5 10 ...
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [out, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
const url = 'file://' + path.resolve('index.html') + '?render' + (process.env.DEBUG ? '&debug' : '');
let t0 = Date.now(); await page.goto(url); await page.waitForFunction(() => window.__film, null, { timeout: 120000 });
await page.evaluate(() => window.__film.ready); console.log('ready in', Date.now() - t0, 'ms');
for (const spec of ts) { const [t, c] = spec.split('@'); const cam = c ? c.split(',').map(Number) : null; t0 = Date.now(); const d = await page.evaluate(([t, cam]) => window.__film.frame(t, cam), [+t, cam]);
  fs.writeFileSync(path.join(out, `t${(+t).toFixed(3).padStart(6, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); console.log('frame', t, Date.now() - t0, 'ms'); }
await browser.close();
