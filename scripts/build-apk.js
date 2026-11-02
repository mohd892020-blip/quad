// Wraps the built game in a small Android app, calling the SDK's own tools directly instead of Gradle.
// The tools and the signing key live outside the repository: every build must carry the same key,
// or a phone refuses to install it over the last one.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const HOME = process.env.FLYING_PIZZA_HOME || join(homedir(), '.flying-pizza');
const MIN_SDK = '24', TARGET_SDK = '34', KEY_ALIAS = 'flying-pizza', KEY_PASS = 'android';
const FONTS = [['Lalezar', 400], ['Tajawal', 400], ['Tajawal', 700], ['Tajawal', 800]];

// each tool unpacks into one folder of its own, whatever its version calls it
const only = name => {
  const dir = join(HOME, name), found = readdirSync(dir, { withFileTypes: true }).find(e => e.isDirectory());
  if (!found) throw new Error(`nothing unpacked in ${dir}`);
  return join(dir, found.name);
};
const jdk = only('jdk'), build = only('build-tools'), platform = only('platform');
const java = join(jdk, 'bin', 'java.exe'), androidJar = join(platform, 'android.jar'), keystore = join(HOME, 'flying-pizza.keystore');
const run = (tool, args, cwd = '.') => execFileSync(tool, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const code = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
const out = 'flying-pizza.apk';

// The app carries everything it uses and has no internet permission: the page's links to the web fonts
// come out, the fonts themselves go in, and the build stops if the page still reaches outside.
function selfContained(page) {
  const faces = FONTS.map(([family, weight]) => {
    const data = readFileSync(join('android', 'fonts', `${family}-${weight}.woff2`)).toString('base64');
    return `@font-face{font-family:${family};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
  }).join('');
  const inside = page.replace(/<link[^>]*fonts\.g[^>]*>\s*/g, '').replace('</head>', () => `<style>${faces}</style></head>`);
  const outside = inside.match(/<(?:link|script|img|audio|video|source)\b[^>]*\b(?:href|src)="(?:https?:)?\/\/[^"]*"/);
  if (outside) throw new Error(`the page still loads from outside: ${outside[0]}`);
  return inside;
}

const tmp = mkdtempSync(join(tmpdir(), 'flying-pizza-apk-'));
const assets = join(tmp, 'assets'), classes = join(tmp, 'classes'), resources = join(tmp, 'res.zip'), base = join(tmp, 'base.apk'), aligned = join(tmp, 'aligned.apk');
mkdirSync(assets);
mkdirSync(classes);
writeFileSync(join(assets, 'index.html'), selfContained(readFileSync(join('dist', 'pages', 'index.html'), 'utf8')));
for (const license of ['OFL-lalezar.txt', 'OFL-tajawal.txt']) copyFileSync(join('android', 'fonts', license), join(assets, license));

run(join(build, 'aapt2.exe'), ['compile', '--dir', join('android', 'res'), '-o', resources]);
run(join(build, 'aapt2.exe'), [
  'link', '-o', base, '-I', androidJar, '--manifest', join('android', 'AndroidManifest.xml'), '-A', assets,
  '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK, '--version-code', code, '--version-name', `${version}.${code}`, resources,
]);

const source = join('android', 'java', 'com', 'flyingpizza', 'game', 'MainActivity.java');
run(join(jdk, 'bin', 'javac.exe'), ['-nowarn', '-Xlint:-options', '-source', '8', '-target', '8', '-bootclasspath', androidJar, '-d', classes, source]);
const compiled = readdirSync(join(classes, 'com', 'flyingpizza', 'game')).map(f => join(classes, 'com', 'flyingpizza', 'game', f));
run(java, ['-cp', join(build, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--lib', androidJar, '--min-api', MIN_SDK, '--output', tmp, ...compiled]);
run(join(build, 'aapt.exe'), ['add', base, 'classes.dex'], tmp);

run(join(build, 'zipalign.exe'), ['-p', '-f', '4', base, aligned]);
if (!existsSync(keystore)) {
  run(join(jdk, 'bin', 'keytool.exe'), [
    '-genkeypair', '-keystore', keystore, '-alias', KEY_ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Flying Pizza', '-storepass', KEY_PASS, '-keypass', KEY_PASS,
  ]);
}
const signer = join(build, 'lib', 'apksigner.jar');
run(java, ['-jar', signer, 'sign', '--v4-signing-enabled', 'false', '--ks', keystore, '--ks-key-alias', KEY_ALIAS, '--ks-pass', `pass:${KEY_PASS}`, '--key-pass', `pass:${KEY_PASS}`, '--out', out, aligned]);
run(java, ['-jar', signer, 'verify', out]);
rmSync(tmp, { recursive: true, force: true });
console.log(`${out} ${(statSync(out).size / 1024).toFixed(1)} kB, version ${version}.${code}`);
