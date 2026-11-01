// Folds the Vite build into one HTML file, the form the game is published in.
import { readFileSync, writeFileSync } from 'node:fs';

const read = href => readFileSync(`dist${href}`, 'utf8');
const html = readFileSync('dist/index.html', 'utf8');

let css = 0, js = 0;
const out = html
  .replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
    css++;
    return `<style>${read(href)}</style>`;
  })
  .replace(/<script type="module"[^>]*src="(\/assets\/[^"]+\.js)"[^>]*><\/script>/, (_, src) => {
    js++;
    return `<script type="module">${read(src).replace(/<\/script/g, '<\\/script')}</script>`;
  });

if (css !== 1 || js !== 1) throw new Error(`expected one stylesheet and one script, found ${css} and ${js}`);
writeFileSync('dist/flying-pizza.html', out);
console.log(`dist/flying-pizza.html ${(out.length / 1024).toFixed(1)} kB`);
