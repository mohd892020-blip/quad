// Writes the page the iPhone app carries, ios/www/index.html, from the built game (npm run build first), the same way
// build-apk.js does for Android: the web fonts come in from android/fonts, and the build stops if the page still loads
// anything from outside. The Firebase key goes in only from the FIREBASE_API_KEY environment variable (a GitHub secret
// on the macOS runner) or ~/.flying-pizza/secrets.json on this machine; without one the app's High Score board stays closed.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FONTS = [['Lalezar', 400], ['Tajawal', 400], ['Tajawal', 700], ['Tajawal', 800]];
const OUT = join('ios', 'www');

function firebaseKey() {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;
  if (process.env.CI) return '';
  const file = join(process.env.FLYING_PIZZA_HOME || join(homedir(), '.flying-pizza'), 'secrets.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).firebaseApiKey || '' : '';
}

const page = readFileSync(join('dist', 'pages', 'index.html'), 'utf8');
const faces = FONTS.map(([family, weight]) => {
  const data = readFileSync(join('android', 'fonts', `${family}-${weight}.woff2`)).toString('base64');
  return `@font-face{font-family:${family};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
}).join('');
const key = firebaseKey();
const keys = `<script>window.FLYING_SECRETS=${JSON.stringify({ firebase: key })}</script>`;
const inside = page.replace(/<link[^>]*fonts\.g[^>]*>\s*/g, '').replace('</head>', () => `<style>${faces}</style>${keys}</head>`);
const outside = inside.match(/<(?:link|script|img|audio|video|source)\b[^>]*\b(?:href|src)="(?:https?:)?\/\/[^"]*"/);
if (outside) throw new Error(`the page still loads from outside: ${outside[0]}`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), inside);
for (const license of ['OFL-lalezar.txt', 'OFL-tajawal.txt']) copyFileSync(join('android', 'fonts', license), join(OUT, license));
console.log(`${OUT}/index.html ${(inside.length / 1024).toFixed(1)} kB, High Score board ${key ? 'on' : 'off (no key)'}`);
