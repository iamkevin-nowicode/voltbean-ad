// Frame-exact video: every frame is drawn at its exact time, then muxed with the synthesised soundtrack.
//   node tools/render.mjs out.mp4 [fps=24]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process'; import os from 'os';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const out = path.resolve(process.argv[2] || 'one-small-light.mp4'), fps = +(process.argv[3] || 24), FILM = 30, N = Math.round(FILM * fps);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osl-')), wav = path.join(tmp, 'sound.wav'), silent = path.join(tmp, 'video.mp4');
execFileSync('node', ['tools/audio.mjs', wav], { stdio: 'inherit' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('file://' + path.resolve('index.html') + '?render'); await page.waitForFunction(() => window.__film);
await page.evaluate(() => window.__film.ready);
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const d = await page.evaluate(t => window.__film.frame(t), i / fps);
  if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 48 === 0) console.log(`frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true }); console.log('wrote', out);
