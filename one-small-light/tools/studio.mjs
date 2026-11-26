// Character studio: runs a drawing snippet inside the built page and saves the canvas.  node tools/studio.mjs out.png snippet.js
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [out, snip] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('file://' + path.resolve('index.html') + '?render');
const d = await p.evaluate(src => { const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const ctx = cv.getContext('2d'); ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, 1600, 900); try { (new Function('ctx', src))(ctx); } catch (e) { return 'ERR ' + e.stack; } return cv.toDataURL('image/png'); }, fs.readFileSync(snip, 'utf8'));
if (d.startsWith('ERR')) console.log(d); else fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
await b.close();
