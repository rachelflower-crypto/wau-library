// We Are Unbecoming · The Library · site builder
// Usage: node build.mjs   →  writes the finished site to ./dist
// Each issue lives in content/issues/<slug>/ : issue.json, books/<book-slug>.html, casefile.html
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const IMG = '/assets/img/';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const exists = (rel) => fs.existsSync(path.join(ROOT, 'src/img', rel));
const words = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const readMins = (html) => Math.max(1, Math.ceil(words(html) / 220));

const L = site.links;
const mailto = (subject, body = '') => `mailto:${L.librarianEmail}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
const privacyHref = site.legal.privacyUrl || '/legal/#privacy';
const tokens = {
  img: IMG,
  subscribeHref: L.substackSubscribe,
  confessionHref: mailto('A confession for Her Indoors', 'Dear Librarian,\n\n(Write your confession here. Please leave out names and places.)\n\n'),
  returnHref: mailto('Through the Return Slot', 'Dear Librarian,\n\n'),
  privacyLine: `How we look after what you send is explained in our <a href="${privacyHref}">privacy notice</a>.`
};
const fill = (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));

// ---------- access (who may read what) ----------
// Levels: 0 = passer-by, 1 = the Curious (free Substack), 2 = the Correspondents (paid Substack)
const ACCESS_LABEL = {
  curious: 'Open to the Curious and the Correspondents',
  correspondents: 'For the Correspondents'
};
const accessLabel = (b) => b.freeOpening ? 'For the Correspondents · opening free to the Curious' : ACCESS_LABEL[b.access] || b.access;
const doorHref = (to, need) => `/door/?to=${encodeURIComponent(to)}${need === 'correspondents' ? '&need=correspondents' : ''}`;
function gateBlock(to) {
  return `<div class="bookplate gate">
<span class="eyebrow muted">Ex libris · The Correspondents</span>
<p class="ex">The rest of this book is kept for the Correspondents.</p>
<p>The Correspondents receive the Librarian’s letters, the whole of every book, and this month’s password, for £9 a month.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"><a class="btn btn-red" href="${L.substackSubscribe}">Become a Correspondent</a><a class="btn btn-line" href="${doorHref(to, 'correspondents')}">Already one? Whisper the password</a></div>
<p class="hand bp-note">Worth every penny. I would say that. — L.</p>
</div>`;
}
const vault = {}; // path -> { curious?: html, correspondents?: html }  (served only by the edge function)

// ---------- shared chrome ----------
function head({ title, description, url, image, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${site.softLaunch ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="icon" href="${IMG}icon-512.png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${site.siteUrl}${url}">
<meta property="og:image" content="${site.siteUrl}${IMG}${image || 'wau-avatar-crimson.png'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
`;
}

function nav(issue, base, inLibrary) {
  const lib = inLibrary ? '' : `${base}library/`;
  return `<header class="nav"><div class="wrap nav-in">
<a class="nav-logo" href="${base}" aria-label="We Are Unbecoming: back to the entrance"><img src="${IMG}wau-single-line-light.png" alt="We Are Unbecoming"></a>
<nav class="nav-links" aria-label="The Library">
<a href="${lib}#letter">The Letter</a>
<a href="${lib}#shelves">The Shelves</a>
<a href="${lib}#catalogue">The Catalogue</a>
<a href="${lib}#ways">Ways in</a>
</nav>
<span class="nav-issue">${esc(issue.label)} · ${esc(issue.month)}</span>
</div></header>
`;
}

function footer(base) {
  const lg = site.legal;
  return `<footer class="foot dark"><div class="wrap">
<div class="foot-in">
<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
<img class="seal-round" src="${IMG}seal.png" alt="The seal of We Are Unbecoming: a most improper society">
<div style="display:flex;flex-direction:column;gap:6px;max-width:460px">
<p class="disp" style="margin:0;font-size:30px;line-height:1.15;font-style:italic">${esc(site.footerLine)}</p>
<p style="margin:0;font-size:16px">${esc(site.societyName)} · ${esc(site.tagline.toLowerCase().replace(/^a /, 'A '))}</p>
</div>
</div>
<nav aria-label="Leaving the Library" style="display:flex;flex-direction:column;gap:10px;font-size:17px">
<a href="${base}">Return to the entrance</a>
<a href="${base}library/#shelves">Back to the shelves</a>
<a href="${L.substack}">The letters, on Substack</a>
</nav>
</div>
<p class="legal-line">${esc(lg.operator)}, trading as ${esc(lg.tradingAs)} · <a href="/legal/">Legal information</a></p>
</div></footer>
</body>
</html>
`;
}

// ---------- spines ----------
const spineInner = (b) => `<span class="bands" aria-hidden="true"><i></i><i></i></span>
<span class="lbl" aria-hidden="true"><span class="gt">${esc(b.spine)}</span></span>
<span class="emb" aria-hidden="true">${esc(b.emblem || '')}</span>
<span class="bands" aria-hidden="true"><i></i><i></i></span>
<span class="whisper" aria-hidden="true">${esc(b.whisper)}</span>`;

function shelfRow(issue, base) {
  const byId = Object.fromEntries(issue.books.map((b) => [b.id, b]));
  return issue.shelf.map((s) => {
    if (s.startsWith('d:')) return `<span class="deco ${s.slice(2)}" aria-hidden="true"></span>`;
    if (s === 'reserved') return `<span class="reserved"><span class="type">RESERVED</span><span class="type">for a future book</span></span>`;
    if (s === 'end') return `<span class="bookend" aria-hidden="true"></span>`;
    const b = byId[s];
    return `<a class="book b-${b.variant}${b.member ? ' is-member' : ''}" href="${base}${b.slug}/" data-principles="${b.principles.join('|')}" aria-label="${esc(b.column)}: ${esc(b.title)}. ${esc(accessLabel(b))}.">
${spineInner(b)}
</a>`;
  }).join('\n');
}

const TOP_ROW = `<span class="deco t2 w3 h2" aria-hidden="true"></span><span class="deco t5 w2 h1" aria-hidden="true"></span><span class="deco t1 w4 h3" aria-hidden="true"></span><span class="deco t7 w2 h2" aria-hidden="true"></span><span class="deco t3 w3 h1" aria-hidden="true"></span><span class="deco t6 w2 h3" aria-hidden="true"></span><span class="deco t4 w4 h2" aria-hidden="true"></span><span class="deco t5 w1 h1" aria-hidden="true"></span><span class="deco t2 w3 h3" aria-hidden="true"></span><span class="deco t3 w2 h2" aria-hidden="true"></span><span class="deco t1 w3 h1" aria-hidden="true"></span>
<button id="secret-book" class="deco t6 w4 h3 secret" type="button" aria-expanded="false" aria-controls="secret-found" aria-label="An untitled book, sitting slightly out of line"></button>
<span class="deco t7 w2 h2" aria-hidden="true"></span><span class="deco t5 w3 h3" aria-hidden="true"></span><span class="deco t2 w2 h1" aria-hidden="true"></span><span class="deco t4 w3 h2" aria-hidden="true"></span><span class="deco t1 w2 h3 lean" aria-hidden="true"></span><span class="deco t3 w4 h2" aria-hidden="true"></span><span class="deco t6 w2 h1" aria-hidden="true"></span><span class="deco t7 w3 h3" aria-hidden="true"></span><span class="deco t5 w2 h2" aria-hidden="true"></span><span class="deco t2 w3 h1" aria-hidden="true"></span><span class="deco t1 w2 h2" aria-hidden="true"></span><span class="deco t4 w2 h3" aria-hidden="true"></span><span class="deco t3 w3 h2" aria-hidden="true"></span><span class="deco t6 w4 h1" aria-hidden="true"></span><span class="deco t7 w2 h3" aria-hidden="true"></span><span class="deco t5 w3 h2" aria-hidden="true"></span>`;

const PRINCIPLES = ['All', 'Recovery', 'Playfulness', 'Curiosity', 'Creativity', 'Freedom', 'Connection', 'Permission'];

// ---------- pages ----------
function entrancePage(issue, base) {
  const art = exists('entrance.svg') ? 'entrance.svg' : exists('entrance.jpg') ? 'entrance.jpg' : 'reading-stand.jpg';
  return head({ title: `${issue.label} · The Library · We Are Unbecoming`, description: 'An invitation to read, question, laugh and occasionally misbehave.', url: base, bodyClass: 'entrance' }) + `
<div class="ent dark grain">
<a class="skip" href="${base}library/">Skip to the Library</a>
<img class="ent-art" src="${IMG}${art}" alt="" aria-hidden="true">
<div class="ent-veil" aria-hidden="true"></div>
<div class="ribbon" aria-hidden="true"><i></i></div>
<div class="ent-top"><span class="eyebrow" style="color:#F3EADB">${esc(site.tagline)}</span></div>
<main class="ent-main">
<div class="mast">
<div style="display:flex;flex-direction:column;gap:14px">
<img src="${IMG}wau-stacked-dark.png" alt="We Are Unbecoming" style="width:clamp(260px,30vw,420px);height:auto;display:block">
<span class="eyebrow" style="color:#F3EADB">${esc(issue.label)} · ${esc(issue.month)}</span>
</div>
<h1><span class="the">The</span>Dispatch</h1>
<p class="tag">An invitation to read, question, laugh and occasionally misbehave.</p>
${issue.theme ? `<p class="theme">This month’s theme: ${esc(issue.theme)}</p>` : ''}
<div style="display:flex;flex-direction:column;gap:16px;align-items:flex-start;width:100%">
<span class="door"><a class="btn btn-brass" href="${base}library/">Enter the Library</a><span class="gap" aria-hidden="true"></span></span>
<a class="alt" href="${base}library/#catalogue">or go straight to the catalogue</a>
</div>
</div>
</main>
<p class="slip">${esc(issue.entranceNote)}<span>— L.</span></p>
</div>
</body>
</html>
`;
}

function libraryPage(issue, base, allIssues) {
  const lt = issue.letter;
  const books = issue.books;
  const cat = books.map((b) => `<li data-principles="${b.principles.join('|')}"><article class="ccard">
<p class="call"><span>${esc(b.call)}</span><span>${esc(b.shelfName)}</span></p>
<h3>${esc(b.column)}</h3>
<p class="it">${esc(b.title)}</p>
<p class="wh">“${esc(b.whisper)}”</p>
<p class="meta">FILED UNDER: ${b.principles.join(' · ')}<br>OPEN TO: ${esc(accessLabel(b))}</p>
<a class="open" href="${base}${b.slug}/">Open the book</a>
</article></li>`).join('\n');
  const past = allIssues.length > 1 ? `<section class="room grain" aria-labelledby="past-h"><div class="wrap">
<h2 id="past-h" class="room-h">Earlier Dispatches</h2>
<p class="room-sub">Every issue stays on the shelf.</p>
<div class="past">${allIssues.map((i) => `<a href="/dispatch/${i.slug}/library/"${i.slug === issue.slug ? ' aria-current="page"' : ''}>${esc(i.label)} · ${esc(i.month)}</a>`).join('')}</div>
</div></section>` : '';

  return head({ title: `The Library · ${issue.label} · We Are Unbecoming`, description: 'Stories, opinions, confessions and curious discoveries. Please open the books.', url: `${base}library/` }) + `<div class="lib">
<a class="skip" href="#catalogue">Skip to the catalogue (list view)</a>
${nav(issue, base, true)}<main>
<section class="room grain" id="letter" aria-labelledby="letter-h">
<div class="wrap letter-grid">
<article class="paper grain" aria-labelledby="letter-h">
<div class="letterhead"><div style="display:flex;flex-direction:column;gap:6px">
<span class="eyebrow muted">From the desk of the Librarian</span>
<h2 id="letter-h" class="disp" style="margin:0;font-size:clamp(34px,3.4vw,44px);font-weight:500;line-height:1.05">${esc(lt.title)}</h2>
</div></div>
${lt.body.map((p) => `<p>${p}</p>`).join('\n')}
<p class="sig">The Librarian</p>
${lt.ps ? `<p class="ps">${esc(lt.ps)}</p>` : ''}
${issue.theme ? `<p class="theme-line">This month’s theme: ${esc(issue.theme)}</p>` : ''}
${lt.margin ? `<span class="anno anno-1" aria-hidden="true">${esc(lt.margin)}</span>` : ''}
</article>
<aside style="display:flex;flex-direction:column;gap:36px;padding-top:12px" aria-label="In this Dispatch">
<img class="desk-art" src="${IMG}desk.svg" alt="On the desk: the Librarian’s spectacles, a brass key and her red fountain pen">
<div class="cardcat">
<h3>In this Dispatch · No. ${issue.number}</h3>
<ol>
${books.map((b) => `<li><a href="${base}${b.slug}/"><span class="n">${esc(b.call)}</span><span class="t">${esc(b.column)}: ${esc(b.title)}</span></a></li>`).join('\n')}
</ol>
${issue.theme ? `<p style="margin:14px 0 0;font-size:14px;color:#5E4E3B">Theme: ${esc(issue.theme)}</p>` : ''}
</div>
</aside>
</div>
</section>

<section class="band dark grain" aria-labelledby="band-h">
<div class="wrap wrap-wide">
<div class="band-head"><h2 id="band-h" class="eyebrow" style="margin:0;color:#F3EADB">From the Librarian’s own shelves</h2><span class="disp" style="font-size:22px;font-style:italic;color:#F3EADB">Respectable on the outside. Do look closer.</span></div>
<div class="band-row">
<figure class="bph"><img src="${IMG}shelf-claret.jpg" alt="A row of claret, rust and black cloth spines with gilt titles, on a dark shelf" loading="lazy"></figure>
<figure class="bph"><img src="${IMG}shelf-dickens.jpg" alt="A matching set of claret leather Dickens volumes with gilt ornaments, beside older reference books" loading="lazy"></figure>
<figure class="bph"><img src="${IMG}shelf-green-red.jpg" alt="Green and red cloth spines, with a stack of green volumes lying flat" loading="lazy"></figure>
</div>
</div>
</section>

<section class="room room-alt grain" id="shelves" aria-labelledby="shelves-h">
<div class="wrap wrap-wide">
<div class="shelf-head">
<div><h2 id="shelves-h" class="room-h">The Shelves</h2><p class="room-sub">Every book has a voice. Every voice needs a reader.</p></div>
<span class="hint" aria-hidden="true">Hover, then open. They’ve been waiting.</span>
</div>
<div class="chips" role="group" aria-label="Browse by principle">
<span class="chips-l">Browse by principle</span>
${PRINCIPLES.map((p, i) => `<button class="chip${i === 0 ? ' is-on' : ''}" type="button" data-principle="${p}" aria-pressed="${i === 0}">${p}</button>`).join('\n')}
</div>
<div class="case">
<div class="cornice" aria-hidden="true"></div>
<div class="row row-top">
${TOP_ROW}
</div>
<div class="plank" aria-hidden="true"></div>
<div class="row row-main">
${shelfRow(issue, base)}
</div>
<div class="plank" aria-hidden="true"></div>
<div style="height:26px"></div>
</div>
<p id="secret-found" class="found" role="status" hidden>${esc(issue.secretShelf)} <b>— L.</b></p>
<p id="shelf-status" class="status" role="status">Showing all ${books.length} books in this Dispatch.</p>
</div>
</section>

<section class="room grain" id="catalogue" aria-labelledby="cat-h">
<div class="wrap">
<h2 id="cat-h" class="room-h">The Catalogue</h2>
<p class="room-sub">For those who prefer an index to an adventure. Same books, fewer theatrics.</p>
<ul class="cat-grid">
${cat}
</ul>
</div>
</section>

<section class="room room-alt grain" id="corners" aria-labelledby="corners-h">
<div class="wrap">
<h2 id="corners-h" class="room-h">Hidden corners</h2>
<p class="room-sub">There is always something else, if you look.</p>
<div class="corners">
<div class="corner">
<span class="eyebrow muted">The Margins</span>
<div class="margins">
<p class="hand" style="font-size:30px;line-height:1.1;color:#2A211D">${esc(issue.margins.quote)}</p>
<p class="hand" style="font-size:24px;color:#8B2E2A;text-align:right;margin-top:10px">${esc(issue.margins.note)} — L.</p>
</div>
</div>
<div class="corner">
<span class="eyebrow muted">The Curiosity Cabinet</span>
<div id="cabinet" class="cab"><div class="cab-in">
<img src="${IMG}enriqueta-rylands.jpg" alt="" aria-hidden="true">
<span class="cdoor cdoor-l" aria-hidden="true"></span><span class="cdoor cdoor-r" aria-hidden="true"></span>
</div></div>
<p class="type" style="margin:0;font-size:15px;line-height:1.6"><b style="letter-spacing:.08em">${esc(issue.cabinet.teaserTitle.toUpperCase())}</b><br>${esc(issue.cabinet.teaser)}</p>
<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
<a class="btn btn-line" href="${base}${issue.cabinet.slug}/">Open the cabinet</a>
<span class="hand" style="font-size:24px;color:#8B2E2A">For the Correspondents. Only if you want to know more. — L.</span>
</div>
</div>
<div class="slot">
<span class="eyebrow muted">The Return Slot</span>
<div class="letterbox" aria-hidden="true"><i></i></div>
<p style="margin:0;font-size:19px;line-height:1.5">Read something that made you laugh in a quiet carriage, or cross enough to write in? Post it back. The Librarian reads everything, eventually.</p>
<div><a class="btn btn-line" href="${tokens.returnHref}">Post a reply</a></div>
</div>
</div>
</div>
</section>

<section class="room grain" id="ways" aria-labelledby="ways-h">
<div class="wrap">
<h2 id="ways-h" class="room-h">Ways in</h2>
<p class="cake">“We do not have tiers, dear. This is a Society, not a wedding cake.”</p>
<div class="ways">
<div class="way">
<span class="eyebrow muted">On Substack</span>
<h3>The Correspondence</h3>
<p class="line">The Librarian writes to the world.</p>
<div>
<div class="door-row"><b>The Curious</b><span class="price">Free</span></div>
<p class="desc">Discover the Society. The Dispatch and the Librarian’s letter, every month.</p>
<div class="door-row"><b>The Correspondents</b><span class="price">£9 a month</span></div>
<p class="desc">Receive the letters and invitations, including a new word from the Lexicon each month with its four invitations.</p>
</div>
<div style="margin-top:8px"><a class="btn btn-red" href="${L.substackSubscribe}">Subscribe on Substack</a></div>
</div>
<div class="way way-dark dark grain">
<img class="speak" src="${IMG}speakeasy-bar.jpg" alt="Red velvet stools along a brass-railed bar, lit low" loading="lazy">
<span class="eyebrow" style="color:#F3EADB">On the Society’s own site</span>
<h3>The Room</h3>
<p class="line">The Company gathers behind closed doors.</p>
<div class="door-row"><b>The Company</b><span class="price">£79 a month</span></div>
<ul class="inc">
<li>Everything the Correspondents receive</li>
<li>The monthly Almanac theme and the Be Musings</li>
<li>The Parlour, a private circle</li>
<li>Invitations to The Salon and The Assembly, the occasional Coterie, and first go at the Experiments</li>
</ul>
<div style="margin-top:8px"><a class="btn btn-brass" href="${L.company}">Knock on the door</a></div>
</div>
</div>
</div>
</section>
${past}
</main>
${footer(base)}`;
}

function bookPage(issue, base, b, mode = 'full') {
  const byId = Object.fromEntries(issue.books.map((x) => [x.id, x]));
  const dir = path.join(ROOT, 'content/issues', issue.slug, 'books');
  const full = fill(fs.readFileSync(path.join(dir, `${b.slug}.html`), 'utf8'));
  let body = full;
  if (mode === 'preview') {
    const own = path.join(dir, `${b.slug}.preview.html`);
    const to = `${base}${b.slug}/`;
    if (fs.existsSync(own)) body = fill(fs.readFileSync(own, 'utf8')).replace('{{gateBlock}}', gateBlock(to));
    else {
      if (!full.includes('<!--more-->')) throw new Error(`${b.slug}: needs <!--more--> (or a .preview.html) to show a free opening`);
      body = full.split('<!--more-->')[0] + `<div class="arow"><div>${gateBlock(to)}</div></div>`;
    }
  }
  const url = `${site.siteUrl}${base}${b.slug}/`;
  const mins = readMins(full);
  const sig = b.signature || 'The Librarian';
  const related = (b.related || []).map((id) => byId[id]).filter(Boolean).map((r) =>
    `<a class="flat v-${r.variant}" href="${base}${r.slug}/"><span class="sp-lbl">${esc(r.spine.replace(/\n/g, ' '))}</span><span class="ft">${esc(r.title)}</span></a>`).join('');
  const plate = accessLabel(b);
  const isLex = b.layout === 'lexicon';
  const byline = `<div class="byline"><span>${esc(b.byline)}</span><span class="dot" aria-hidden="true">·</span><span>${esc(issue.month)}</span>${isLex ? '' : `<span class="dot" aria-hidden="true">·</span><span>${mins} minute read</span>`}<span class="plate">${esc(plate)}</span></div>`;
  const header = `<div class="${b.darkhead ? 'darkhead grain' : ''}">
<div class="wrap backbar"><a class="back" href="${base}library/#shelves"><span aria-hidden="true">←</span> Back to the shelves</a><span class="type nav-issue2" style="font-size:13px">${esc(issue.label)} · ${esc(b.call)}${isLex ? ' · ' + esc(b.shelfName) : ''}</span></div>
<header class="wrap ahead">
<div class="aspine v-${b.variant}" aria-hidden="true"${isLex ? ' style="min-height:240px"' : ''}><span class="bands"><i></i><i></i></span><span class="sp-lbl">${esc(b.spine.replace(/\n/g, ' '))}</span><span class="bands"><i></i><i></i></span></div>
<div class="atitle">
<span class="eyebrow">${esc(b.column)} · ${isLex ? 'A word, taken apart (with some liberties)' : esc(b.shelfName)}</span>
${isLex ? '' : `<h1>${esc(b.title)}</h1>`}
<p class="dek"${isLex ? ' style="max-width:44ch"' : ''}>${esc(b.dek)}</p>
${byline}
</div>
</header>
</div>`;
  const fig = b.image ? `<figure class="afig wrap"><img src="${IMG}${b.image.src}" alt="${esc(b.image.alt)}"><figcaption><span>${esc(b.image.caption)}</span><span class="type" style="font-style:normal;font-size:13px">Photograph: ${esc(b.image.credit || 'The Librarian')}</span></figcaption></figure>` : '';
  const endBlock = `<div class="end">
<div style="display:flex;flex-direction:column;gap:14px">
<span class="eyebrow muted">Pass it on</span>
<div class="share">
<button class="btn btn-line" type="button" data-copy="${url}">Copy link</button>
<a class="btn btn-line" href="mailto:?subject=${encodeURIComponent('Something from the Library: ' + b.title)}&amp;body=${encodeURIComponent(url)}">Email a friend</a>
<a class="btn btn-line" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">LinkedIn</a>
</div>
<span class="copied" role="status" hidden>The link is on your clipboard.</span>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<span class="eyebrow muted">Another book?</span>
${related}
<a class="back" href="${base}library/#shelves"><span aria-hidden="true">←</span> Back to the shelves</a>
</div>
</div>`;
  const main = isLex
    ? `<main id="read" class="wrap" style="padding-bottom:80px">
${body}
${mode === 'preview' ? '' : `<div style="max-width:1320px;margin:56px auto 0">${endBlock}</div>`}
</main>`
    : `${fig}<main id="read" class="wrap abody">
${body}
${mode === 'preview' ? '' : `<div class="arow"><div>
<p class="sign">${esc(sig)}</p>
${endBlock}
</div></div>`}
</main>
<div style="height:64px"></div>`;
  return head({ title: `${b.title} · ${b.column} · We Are Unbecoming`, description: b.dek, url: `${base}${b.slug}/`, image: b.image ? b.image.src : undefined }) + `<div class="art">
<a class="skip" href="#read">Skip to the ${isLex ? 'word' : 'text'}</a>
${nav(issue, base, false)}${header}
${main}
${footer(base)}`;
}

function doorPage(issue, base, { to, need, title, what }) {
  const corr = need === 'correspondents';
  return head({ title: `${title} · The Library · We Are Unbecoming`, description: 'A members’ door in the Library.', url: to }) + `${nav(issue, base, false)}
<main class="doorpage grain" id="read">
<div class="door-card">
<span class="eyebrow muted">${esc(issue.label)} · ${esc(what || 'A door in the Library')}</span>
<h1>${esc(title)}</h1>
<p class="lede-d">${corr
    ? 'This one is kept for the Correspondents. Whisper this month’s password, the one in the Librarian’s paid letter, and the door will open.'
    : 'The door is closed, but not locked. Whisper this month’s password. You’ll find it in the Librarian’s latest letter on Substack.'}</p>
<p class="wrong" role="alert" hidden>That isn’t quite it. Check the letter, then try again. (Capital letters don’t matter.)</p>
<form method="post" action="/door" class="door-form">
<input type="hidden" name="to" value="${esc(to)}">
<label for="pw">The password</label>
<div class="door-row2"><input id="pw" name="password" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="btn btn-brass" type="submit">Let me in</button></div>
</form>
${corr ? '' : `<form method="post" action="/door" class="mischief">
<input type="hidden" name="to" value="${esc(to)}">
<input type="hidden" name="mischief" value="1">
<p>No letter to hand? Then a confession will do.</p>
<button class="btn btn-line" type="submit">I have been mischievous</button>
</form>`}
<p class="small">Not yet on the list? <a href="${L.substackSubscribe}">Join the Curious on Substack</a>${corr ? ', then become a Correspondent for £9 a month.' : '. It’s free.'}</p>
<p class="hand bp-note">The door remembers you for a month. — L.</p>
</div>
</main>
<script>(function(){var q=new URLSearchParams(location.search);if(q.get('wrong'))document.querySelector('.wrong').hidden=false;var t=q.get('to');if(t&&t.charAt(0)==='/'&&t.charAt(1)!=='/')document.querySelectorAll('input[name=to]').forEach(function(i){i.value=t;});})();</script>
${footer(base)}`;
}

function cabinetPage(issue, base, mode) {
  const c = issue.cabinet;
  const inner = mode === 'full'
    ? `<article class="casefile" aria-labelledby="cf-h" style="margin-top:0">
${fill(fs.readFileSync(path.join(ROOT, 'content/issues', issue.slug, c.file), 'utf8'))}
</article>`
    : `<div class="arow"><div><p class="type" style="font-size:16px;line-height:1.6"><b style="letter-spacing:.08em">${esc(c.teaserTitle.toUpperCase())}</b><br>${esc(c.teaser)}</p>${gateBlock(`${base}${c.slug}/`)}</div></div>`;
  return head({ title: `The Curiosity Cabinet · ${issue.label} · We Are Unbecoming`, description: c.teaser, url: `${base}${c.slug}/` }) + `<div class="art">
<a class="skip" href="#read">Skip to the case file</a>
${nav(issue, base, false)}
<div class="wrap backbar"><a class="back" href="${base}library/#corners"><span aria-hidden="true">←</span> Back to the Library</a><span class="type nav-issue2" style="font-size:13px">${esc(issue.label)} · The Curiosity Cabinet</span></div>
<main id="read" class="wrap" style="padding:24px 0 80px">
${inner}
</main>
${footer(base)}`;
}

function legalPage(issue) {
  const lg = site.legal;
  const base = `/dispatch/${issue.slug}/`;
  return head({ title: 'Legal information · We Are Unbecoming', description: 'Who runs the Library, and how to reach us.', url: '/legal/' }) + `${nav(issue, base, false)}
<main class="legal">
<h1>Legal information</h1>
<p>The Library and the Dispatch are published by ${esc(lg.operator)}, trading as ${esc(lg.tradingAs)}.</p>
<dl>
<dt>Company name</dt><dd>${esc(lg.operator)}</dd>
<dt>Trading as</dt><dd>${esc(lg.tradingAs)}</dd>
<dt>Registered in</dt><dd>${esc(lg.registeredIn)}</dd>
<dt>Company number</dt><dd>${esc(lg.companyNumber)}</dd>
<dt>Registered office</dt><dd>${esc(lg.registeredOffice)}</dd>
<dt>VAT number</dt><dd>${esc(lg.vatNumber)}</dd>
<dt>Contact</dt><dd><a href="mailto:${L.librarianEmail}">${L.librarianEmail}</a></dd>
</dl>
<h2 id="privacy">Privacy</h2>
${lg.privacyUrl ? `<p>Our <a href="${lg.privacyUrl}">privacy notice</a> explains what we collect and why.</p>` : `<p>[Privacy notice to come: what we collect when you write to the Librarian or send a confession, why, how long we keep it, and your rights.]</p>`}
<p>This site doesn’t use tracking cookies. Fonts are loaded from Google Fonts.</p>
${lg.termsUrl ? `<h2>Terms</h2><p>Membership terms are set out on <a href="${lg.termsUrl}">the Society’s website</a>.</p>` : ''}
</main>
${footer(base)}`;
}

function substackPage(issue, base) {
  const sp = issue.books.map((b) => `<a href="${site.siteUrl}${base}${b.slug}/" style="display:block;text-decoration:none" title="${esc(b.column)}: ${esc(b.title)}">${esc(b.column)}: <i>${esc(b.title)}</i></a>`).join('\n');
  return head({ title: `${issue.label} · Substack letter (template)`, description: 'Copy into Substack.', url: `${base}substack/` }) + `<main class="legal">
<p class="type" style="font-size:13px;color:#5E4E3B">Substack letter template · not linked from the site. Copy the text below into a new Substack post; use the header image and link each book.</p>
<h1>${esc(issue.label)} · ${esc(issue.month)}</h1>
${issue.theme ? `<p><b>This month’s theme:</b> ${esc(issue.theme)}</p>` : ''}
<h2>On the shelves this month</h2>
${sp}
<h2>From the desk of the Librarian</h2>
${issue.letter.body.map((p) => `<p>${p}</p>`).join('\n')}
<p><i>The Librarian</i></p>
<p><a class="btn btn-red" href="${site.siteUrl}${base}">Enter the Library</a></p>
<hr>
<p style="font-size:16px">Free subscribers are among The Curious. The Correspondents also receive this month’s Lexicon word and its four invitations (£9 a month).</p>
</main>
</body></html>`;
}

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/img'), { recursive: true });
fs.cpSync(path.join(ROOT, 'src/img'), path.join(OUT, 'assets/img'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src/css/site.css'), path.join(OUT, 'assets/site.css'));
fs.copyFileSync(path.join(ROOT, 'src/js/site.js'), path.join(OUT, 'assets/site.js'));

const issues = fs.readdirSync(path.join(ROOT, 'content/issues')).sort()
  .map((d) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/issues', d, 'issue.json'), 'utf8')));
const latest = issues[issues.length - 1];

for (const issue of issues) {
  const base = `/dispatch/${issue.slug}/`;
  write(`dispatch/${issue.slug}/index.html`, entrancePage(issue, base));
  write(`dispatch/${issue.slug}/library/index.html`, libraryPage(issue, base, issues));
  for (const b of issue.books) {
    const to = `${base}${b.slug}/`;
    write(`dispatch/${issue.slug}/${b.slug}/index.html`, doorPage(issue, base, { to, need: 'curious', title: b.title, what: b.column }));
    if (b.access === 'correspondents') vault[to] = { correspondents: bookPage(issue, base, b, 'full'), ...(b.freeOpening ? { curious: bookPage(issue, base, b, 'preview') } : {}) };
    else vault[to] = { curious: bookPage(issue, base, b, 'full') };
  }
  if (issue.cabinet && issue.cabinet.slug) {
    const to = `${base}${issue.cabinet.slug}/`;
    write(`dispatch/${issue.slug}/${issue.cabinet.slug}/index.html`, doorPage(issue, base, { to, need: 'curious', title: 'The Curiosity Cabinet', what: issue.cabinet.teaserTitle }));
    vault[to] = { correspondents: cabinetPage(issue, base, 'full'), curious: cabinetPage(issue, base, 'preview') };
  }
  write(`dispatch/${issue.slug}/substack/index.html`, substackPage(issue, base));
}
write('legal/index.html', legalPage(latest));
write('door/index.html', doorPage(latest, `/dispatch/${latest.slug}/`, { to: `/dispatch/${latest.slug}/library/`, need: 'curious', title: 'Whisper the password', what: 'The members’ door' }));
// The vault: members' pages, bundled into the edge function and never published as files
fs.mkdirSync(path.join(ROOT, 'netlify/vault'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'netlify/vault/pages.js'), `// Generated by build.mjs. Do not edit.\nexport default ${JSON.stringify(vault)};\n`);
write('_redirects', `/            /dispatch/${latest.slug}/          302\n/library     /dispatch/${latest.slug}/library/  302\n`);
write('index.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/dispatch/${latest.slug}/"><link rel="canonical" href="/dispatch/${latest.slug}/"><title>The Library · We Are Unbecoming</title><a href="/dispatch/${latest.slug}/">Enter the Library</a>`);
write('robots.txt', site.softLaunch ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n');
console.log(`Built ${issues.length} issue(s); latest ${latest.label}.`);
