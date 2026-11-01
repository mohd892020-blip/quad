// Folds the Vite build into one file in the form Artifacts publish: page content only,
// because publishing wraps it in its own doctype, head and body.
import { readFileSync, writeFileSync } from 'node:fs';

const read = href => readFileSync(`dist${href}`, 'utf8');
const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>\s*/g, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];

let css = 0, js = 0;
const page = `${head}${body}`
  .replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
    css++;
    return `<style>${read(href)}</style>`;
  })
  .replace(/<script type="module"[^>]*src="(\/assets\/[^"]+\.js)"[^>]*><\/script>/, (_, src) => {
    js++;
    return `<script type="module">${read(src).replace(/<\/script/g, '<\\/script')}</script>`;
  });

if (css !== 1 || js !== 1) throw new Error(`expected one stylesheet and one script, found ${css} and ${js}`);
if (!page.trimStart().startsWith('<title>') && !page.slice(0, 8192).includes('<title>')) throw new Error('title must sit in the first 8KB');
writeFileSync('dist/flying-pizza.html', page);
console.log(`dist/flying-pizza.html ${(page.length / 1024).toFixed(1)} kB`);
