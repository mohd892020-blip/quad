import { ONLINE } from './config.js';
import { online, saveOnline, settings } from './storage.js';

// The world High Score board over Firebase's REST endpoints: an anonymous sign-in gives this device a player id, and one
// document per player, named by that id, holds { name, score }. Every call can fail or time out; callers fall back to the
// ladder kept on this device.

// written into the Android app by npm run apk; the web build has none, so its board stays closed
const KEY = window.FLYING_SECRETS?.firebase || '';
const DOCS = `https://firestore.googleapis.com/v1/projects/${ONLINE.project}/databases/(default)/documents`;
const NAME = new RegExp(`^[A-Za-z0-9 ]{${ONLINE.name.min},${ONLINE.name.max}}$`);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
// Sh1t reads as shit; fold turns fuuuck into fuck
const leet = s => s.toLowerCase().replace(/[0-9]/g, d => LEET[d] ?? d);
const fold = s => s.replace(/(.)\1+/g, '$1');

function rude(name) {
  const { parts, words } = ONLINE.rude, joined = leet(name.replace(/ /g, ''));
  if (parts.some(p => joined.includes(p) || fold(joined).includes(fold(p)))) return true;
  // each word is tried as typed (a7a), with its digits read as letters, and both folded
  return name.split(' ').some(w => [w.toLowerCase(), leet(w), fold(w.toLowerCase()), fold(leet(w))].some(f => words.includes(f)));
}

// inside the Android app, or in developer mode so the board can be tried in a browser that has the key
export const onlineReady = () => !!KEY && (!!window.PizzaScreen || settings.dev);

// Only what a nickname may hold, for the field to drop as the player types.
export const nameChars = raw => String(raw ?? '').replace(/[^A-Za-z0-9 ]/g, '');

// Trims and folds runs of spaces. { name } when it keeps the rule firestore.rules also checks, else { error: 'chars' }
// (length, letters) or { error: 'rude' }.
export function checkName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!NAME.test(name) || !/[A-Za-z]/.test(name)) return { error: 'chars' };
  return rude(name) ? { error: 'rude' } : { name };
}

async function call(url, init = {}) {
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), ONLINE.timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: stop.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message || body?.[0]?.error?.message || `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// The id token lives in memory; the refresh token is kept, so the same player id survives restarts.
let id = { token: '', until: 0 };
async function token() {
  if (id.token && Date.now() < id.until) return id.token;
  let fresh;
  if (online.refresh) {
    try {
      const r = await call(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(online.refresh)}`,
      });
      fresh = { token: r.id_token, refresh: r.refresh_token, uid: r.user_id, life: +r.expires_in };
    } catch (e) {
      // a refresh token Firebase no longer knows means a new player; a network failure is just a failure
      if (!/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED/.test(e.message)) throw e;
    }
  }
  if (!fresh) {
    const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    fresh = { token: r.idToken, refresh: r.refreshToken, uid: r.localId, life: +r.expiresIn };
    // a new player id owns nothing on the board yet
    if (fresh.uid !== online.uid) online.sent = -1;
  }
  Object.assign(online, { uid: fresh.uid, refresh: fresh.refresh });
  saveOnline();
  id = { token: fresh.token, until: Date.now() + (fresh.life - 60) * 1000 };
  return id.token;
}

const auth = async () => ({ Authorization: `Bearer ${await token()}` });

// signs in first: a new player has no id until then, and the address needs it
async function write(fields, mask) {
  const head = await auth();
  return call(`${DOCS}/${ONLINE.collection}/${online.uid}?${mask.map(f => `updateMask.fieldPaths=${f}`).join('&')}`, {
    method: 'PATCH', headers: { ...head, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  });
}

// Puts this player's name and score on the board. The rules refuse a score lower than the one already there (progress
// reset on this device, say): then only the name changes, and the board's own score is kept and remembered as sent.
export async function sendScore(name, score) {
  try {
    await write({ name: { stringValue: name }, score: { integerValue: String(score) } }, ['name', 'score']);
  } catch (e) {
    if (!/permission/i.test(e.message)) throw e;
    const kept = await write({ name: { stringValue: name } }, ['name']);
    score = +(kept?.fields?.score?.integerValue ?? score);
  }
  Object.assign(online, { name, sent: score });
  saveOnline();
}

const query = (extra = {}) => ({ from: [{ collectionId: ONLINE.collection }], ...extra });
async function count(where) {
  const r = await call(`${DOCS}:runAggregationQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: query(where ? { where } : {}), aggregations: [{ alias: 'n', count: {} }] } }),
  });
  return +(r?.[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

// The top of the board, this player's rank by score and how many players there are.
export async function readBoard(score) {
  const above = { fieldFilter: { field: { fieldPath: 'score' }, op: 'GREATER_THAN', value: { integerValue: String(score) } } };
  const [top, ahead, total] = await Promise.all([
    call(`${DOCS}:runQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: query({ orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit: ONLINE.top }) }),
    }),
    count(above),
    count(),
  ]);
  const rows = top.filter(r => r.document).map(({ document: d }) => ({
    uid: d.name.slice(d.name.lastIndexOf('/') + 1),
    name: d.fields?.name?.stringValue ?? '',
    score: +(d.fields?.score?.integerValue ?? 0),
  }));
  return { rows, rank: ahead + 1, total };
}
