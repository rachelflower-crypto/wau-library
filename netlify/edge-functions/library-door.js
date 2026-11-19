// We Are Unbecoming · The Library · the members' door
// Runs on Netlify before every Dispatch page. Members' pages live in the vault (bundled here),
// never as public files. A signed cookie remembers who has whispered which password.
//
// Netlify environment variables (scope: Functions):
//   CURIOUS_PASSWORD         this month's password in the free letter
//   CORRESPONDENTS_PASSWORD  this month's password in the paid letter
//   LIBRARY_SECRET           a long random string; change it to send everyone back to the door
import vault from '../vault/pages.js';

const COOKIE = 'wau_door';
const DAYS = 40;
const enc = new TextEncoder();
const env = (k) => (globalThis.Netlify && Netlify.env.get(k)) || '';
const norm = (s) => String(s || '').trim().toLowerCase();

async function sign(text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env('LIBRARY_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// The signature includes the level's current password, so changing a password closes the door to old cookies.
const pwFor = (level) => norm(env(level === 'correspondents' ? 'CORRESPONDENTS_PASSWORD' : 'CURIOUS_PASSWORD'));

async function makeCookie(level) {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const body = `${level}.${exp}`;
  return `${COOKIE}=${body}.${await sign(`${body}.${pwFor(level)}`)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

async function levelOf(request) {
  if (!env('LIBRARY_SECRET')) return 0;
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return 0;
  const [level, exp, sig] = m[1].split('.');
  if (!['curious', 'correspondents'].includes(level) || !(Number(exp) > Date.now() / 1000) || !pwFor(level)) return 0;
  if ((await sign(`${level}.${exp}.${pwFor(level)}`)) !== sig) return 0;
  return level === 'correspondents' ? 2 : 1;
}

const safeTo = (to) => (typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') ? to : '/');
const go = (to, cookie) => new Response(null, { status: 303, headers: { Location: to, 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });

export default async (request, context) => {
  const url = new URL(request.url);

  // The door: password (or confession) posted from a door page
  if (url.pathname === '/door' || url.pathname === '/door/') {
    if (request.method !== 'POST') return context.next();
    const form = await request.formData();
    const to = safeTo(form.get('to'));
    if (!env('LIBRARY_SECRET')) return go(`/door/?wrong=1&to=${encodeURIComponent(to)}`);
    const said = norm(form.get('password'));
    let level = '';
    if (form.get('mischief')) level = pwFor('curious') ? 'curious' : '';
    else if (said && said === pwFor('correspondents')) level = 'correspondents';
    else if (said && said === pwFor('curious')) level = 'curious';
    if (!level) return go(`/door/?wrong=1&to=${encodeURIComponent(to)}`);
    // Never downgrade a Correspondent who confesses to mischief
    if (level === 'curious' && (await levelOf(request)) === 2) return go(to);
    return go(to, await makeCookie(level));
  }

  // A Dispatch page: serve the members' version if this reader may see it
  let p = url.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  const entry = vault[p];
  if (!entry) return context.next();
  const lvl = await levelOf(request);
  const html = lvl >= 2 ? entry.correspondents || entry.curious : lvl === 1 ? entry.curious : null;
  if (!html) return context.next(); // the public file at this address is the door
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
};

export const config = { path: ['/dispatch/*', '/door', '/door/'], excludedPath: ['/assets/*'] };
