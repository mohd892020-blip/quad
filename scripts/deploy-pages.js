// Publishes dist/pages to the gh-pages branch as a single fresh commit.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const remote = git('.', 'remote', 'get-url', 'origin');
const name = git('.', 'config', 'user.name'), email = git('.', 'config', 'user.email');
const source = git('.', 'rev-parse', '--short', 'HEAD');

const dir = mkdtempSync(join(tmpdir(), 'flying-parcel-pages-'));
copyFileSync('dist/pages/index.html', join(dir, 'index.html'));
writeFileSync(join(dir, '.nojekyll'), '');
git(dir, 'init', '-q', '-b', 'gh-pages');
git(dir, 'add', '.');
git(dir, '-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', `Deploy Flying Parcel from ${source}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`);
git(dir, 'push', '--force', '--quiet', remote, 'gh-pages');
try { rmSync(dir, { recursive: true, force: true }); } catch (_) {}
console.log(`gh-pages updated from ${source}`);
