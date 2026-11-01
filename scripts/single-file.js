// Folds the Vite build into one file, in two forms: page content only for Artifacts,
// which wrap it in their own doctype, head and body, and a whole page for GitHub Pages.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const read = href => readFileSync(`dist${href}`, 'utf8');
const html = readFileSync('dist/index.html', 'utf8');

function fold(source) {
  let css = 0, js = 0;
  const page = source
    .replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
      css++;
      return `<style>${read(href)}</style>`;
    })
    .replace(/<script type="module"[^>]*src="(\/assets\/[^"]+\.js)"[^>]*><\/script>/, (_, src) => {
      js++;
      return `<script type="module">${read(src).replace(/<\/script/g, '<\\/script')}</script>`;
    });
  if (css !== 1 || js !== 1) throw new Error(`expected one stylesheet and one script, found ${css} and ${js}`);
  return page;
}

const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>\s*/g, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const artifact = fold(`${head}${body}`);
if (!artifact.slice(0, 8192).includes('<title>')) throw new Error('title must sit in the first 8KB');
writeFileSync('dist/flying-pizza.html', artifact);

mkdirSync('dist/pages', { recursive: true });
writeFileSync('dist/pages/index.html', fold(html));
console.log(`dist/flying-pizza.html ${(artifact.length / 1024).toFixed(1)} kB, dist/pages/index.html ready`);
