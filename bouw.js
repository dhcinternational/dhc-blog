/* --------------------------------------------------------------------------
   Bouwscript voor de blog van De Handels Club.

   Wat het doet: het leest de artikelen uit de map "posts" (dat zijn de
   bestanden die je via /admin schrijft) en maakt daar echte webpagina's van,
   elk met een eigen adres. Het resultaat komt in de map "dist" te staan.

   Netlify draait dit script bij elke wijziging. Je hoeft er zelf niets mee.
   -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const WORTEL = __dirname;
const UIT = path.join(WORTEL, 'dist');
const SITE = 'https://blog.dehandelsclub.nl';

/* ----------------------------------------------------------- hulpmiddeltjes */

function veilig(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(t) {
  return String(t).toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function datumNL(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const maanden = ['januari','februari','maart','april','mei','juni',
                   'juli','augustus','september','oktober','november','december'];
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
}

/* ------------------------------------------------------------- frontmatter */

function leesArtikel(bestand) {
  const ruw = fs.readFileSync(bestand, 'utf8');
  const m = ruw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: ruw.trim() };

  const data = {};
  for (const regel of m[1].split(/\r?\n/)) {
    const i = regel.indexOf(':');
    if (i < 1) continue;
    const sleutel = regel.slice(0, i).trim();
    let waarde = regel.slice(i + 1).trim();
    if (/^["'].*["']$/.test(waarde)) waarde = waarde.slice(1, -1);
    data[sleutel] = waarde;
  }
  return { data, body: m[2].trim() };
}

/* ------------------------------------------------------- markdown naar html
   Bewust klein gehouden: koppen, vet, cursief, links, lijstjes en alinea's.
   Dat is alles wat de redactie-omgeving oplevert.                            */

function inline(t) {
  let s = veilig(t);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, tekst, url) => {
    const schoon = /^(https?:\/\/|\/|mailto:|#)/i.test(url) ? url : '#';
    const extern = /^https?:\/\//i.test(schoon) && !schoon.includes('dehandelsclub.nl');
    return `<a href="${veilig(schoon)}"${extern ? ' rel="noopener"' : ''}>${tekst}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function naarHtml(md) {
  const regels = md.split(/\r?\n/);
  const uit = [];
  let lijst = null;

  const sluitLijst = () => {
    if (lijst) { uit.push(`<${lijst.type}>\n${lijst.items.join('\n')}\n</${lijst.type}>`); lijst = null; }
  };

  for (const r of regels) {
    const regel = r.trim();

    if (!regel) { sluitLijst(); continue; }

    const kop = regel.match(/^(#{1,6})\s+(.*)$/);
    if (kop) {
      sluitLijst();
      // Alles onder de titel wordt een h2 of h3; de h1 is de artikeltitel zelf.
      const niveau = kop[1].length <= 2 ? 2 : 3;
      uit.push(`<h${niveau}>${inline(kop[2])}</h${niveau}>`);
      continue;
    }

    const opsomming = regel.match(/^[-*+]\s+(.*)$/);
    if (opsomming) {
      if (!lijst || lijst.type !== 'ul') { sluitLijst(); lijst = { type: 'ul', items: [] }; }
      lijst.items.push(`  <li>${inline(opsomming[1])}</li>`);
      continue;
    }

    const genummerd = regel.match(/^\d+[.)]\s+(.*)$/);
    if (genummerd) {
      if (!lijst || lijst.type !== 'ol') { sluitLijst(); lijst = { type: 'ol', items: [] }; }
      lijst.items.push(`  <li>${inline(genummerd[1])}</li>`);
      continue;
    }

    sluitLijst();
    uit.push(`<p>${inline(regel)}</p>`);
  }
  sluitLijst();
  return uit.join('\n');
}

/* ------------------------------------------------------------------ sjabloon */

const STIJL = fs.readFileSync(path.join(WORTEL, 'stijl.css'), 'utf8');

function pagina({ titel, omschrijving, pad, inhoud, foto }) {
  const url = SITE + pad;
  const afbeelding = foto ? (foto.startsWith('http') ? foto : SITE + foto) : '';
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${veilig(titel)}</title>
<meta name="description" content="${veilig(omschrijving)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${veilig(url)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${veilig(url)}">
<meta property="og:title" content="${veilig(titel)}">
<meta property="og:description" content="${veilig(omschrijving)}">
${afbeelding ? `<meta property="og:image" content="${veilig(afbeelding)}">` : ''}
<meta property="og:site_name" content="De Handels Club">
<meta property="og:locale" content="nl_NL">
<meta name="twitter:card" content="${afbeelding ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="#0d1b2a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
${STIJL}
</style>
</head>
<body>

<header>
  <a class="logo" href="/">
    <div class="logo-ring">HC</div>
    <div>
      <div class="logo-text">De Handels Club</div>
      <span class="logo-sub">INZICHTEN &amp; NIEUWS</span>
    </div>
  </a>
  <nav>
    <a href="https://dehandelsclub.nl" rel="noopener">&larr; Hoofdsite</a>
    <a href="https://dehandelsclub.nl/portaal" rel="noopener">Portaal</a>
  </nav>
</header>

${inhoud}

<footer>
  &copy; 2026 De Handels Club &nbsp;|&nbsp; <a href="https://dehandelsclub.nl" rel="noopener">dehandelsclub.nl</a>
</footer>

</body>
</html>
`;
}

/* ----------------------------------------------------------------- uitvoeren */

function leegmaken(map) {
  if (fs.existsSync(map)) fs.rmSync(map, { recursive: true, force: true });
  fs.mkdirSync(map, { recursive: true });
}

function kopieer(van, naar) {
  if (!fs.existsSync(van)) return;
  fs.cpSync(van, naar, { recursive: true });
}

leegmaken(UIT);

const mapPosts = path.join(WORTEL, 'posts');
const bestanden = fs.existsSync(mapPosts)
  ? fs.readdirSync(mapPosts).filter(f => f.endsWith('.md'))
  : [];

const artikelen = bestanden.map(bestand => {
  const { data, body } = leesArtikel(path.join(mapPosts, bestand));
  const titel = (data.title || data.titel || bestand.replace(/\.md$/, '')).trim();
  return {
    titel,
    // Het adres volgt de bestandsnaam. Die kies jij in /admin, en hij blijft
    // staan ook als je de titel later nog eens aanpast.
    slug: slugify(data.slug || bestand.replace(/\.md$/, '')),
    datum: data.date || data.datum || '',
    categorie: (data.category || data.categorie || 'Nieuws').trim(),
    samenvatting: (data.summary || data.samenvatting || '').trim(),
    foto: (data.thumbnail || data.omslagfoto || '').trim(),
    body
  };
}).filter(a => a.slug);

artikelen.sort((a, b) => new Date(b.datum) - new Date(a.datum));

/* -- de losse artikelpagina's -- */
for (const a of artikelen) {
  const anderen = artikelen.filter(x => x.slug !== a.slug).slice(0, 3);
  const verder = anderen.length ? `
  <div class="verder">
    <p class="kop">LEES OOK</p>
    <ul>
${anderen.map(x => `      <li><a href="/${x.slug}">${veilig(x.titel)}</a></li>`).join('\n')}
    </ul>
  </div>` : '';

  const inhoud = `
<div class="artikel">
  <a class="artikel-terug" href="/">&larr; Terug naar overzicht</a>
  <div class="artikel-cat">${veilig(a.categorie.toUpperCase())}</div>
  <h1>${veilig(a.titel)}</h1>
  <div class="artikel-meta">${datumNL(a.datum)}</div>
  ${a.foto ? `<img class="cover" src="${veilig(a.foto)}" alt="${veilig(a.titel)}" loading="lazy" decoding="async">` : ''}
  <div class="artikel-inhoud">
${naarHtml(a.body)}

    <div class="cta">
      <p>Benieuwd wat er op dit moment wordt aangeboden?</p>
      <p><a href="https://dehandelsclub.nl/portaal" rel="noopener">Bekijk het besloten portaal &rarr;</a></p>
    </div>
  </div>${verder}
</div>`;

  fs.writeFileSync(path.join(UIT, a.slug + '.html'),
    pagina({
      titel: `${a.titel} | De Handels Club`,
      omschrijving: a.samenvatting || a.titel,
      pad: '/' + a.slug,
      inhoud,
      foto: a.foto
    }));
}

/* -- het overzicht -- */
const kaarten = artikelen.map(a => `
      <a class="post-card" href="/${a.slug}">
        ${a.foto ? `<img src="${veilig(a.foto)}" alt="${veilig(a.titel)}" loading="lazy" decoding="async">` : ''}
        <div class="post-card-body">
          <div class="post-cat">${veilig(a.categorie.toUpperCase())}</div>
          <div class="post-title">${veilig(a.titel)}</div>
          <div class="post-summary">${veilig(a.samenvatting)}</div>
          <div class="post-date">${datumNL(a.datum)}</div>
        </div>
      </a>`).join('\n');

fs.writeFileSync(path.join(UIT, 'index.html'), pagina({
  titel: 'Inzichten & Nieuws | De Handels Club',
  omschrijving: 'Kennis over bedrijfsoverdrachten, vastgoed, bemiddeling en besloten handel.',
  pad: '/',
  inhoud: `
<section class="hero">
  <div class="hero-label">BLOG</div>
  <h1>Inzichten &amp; Nieuws</h1>
  <p>Kennis over bedrijfsoverdrachten, vastgoed, bemiddeling en besloten handel.</p>
</section>

<section class="posts">
  <div class="posts-grid">
${kaarten || '<p style="color:#888;font-family:sans-serif">Het eerste artikel komt binnenkort.</p>'}
  </div>
</section>`
}));

/* -- sitemap, robots, redirects -- */
const vandaag = new Date().toISOString().slice(0, 10);
const regels = [`  <url><loc>${SITE}/</loc><lastmod>${vandaag}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`]
  .concat(artikelen.map(a => {
    const d = new Date(a.datum);
    const lm = isNaN(d) ? vandaag : d.toISOString().slice(0, 10);
    return `  <url><loc>${SITE}/${a.slug}</loc><lastmod>${lm}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
  }));

fs.writeFileSync(path.join(UIT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${regels.join('\n')}
</urlset>
`);

fs.writeFileSync(path.join(UIT, 'robots.txt'),
`User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE}/sitemap.xml
`);

fs.writeFileSync(path.join(UIT, '_redirects'),
`# De .html-versie stuurt door naar het korte adres
${artikelen.map(a => `/${a.slug}.html   /${a.slug}   301!`).join('\n')}

# Alles wat niet bestaat: het overzicht tonen
/*  /index.html  404
`);

/* -- de redactie-omgeving en de foto's gaan mee -- */
kopieer(path.join(WORTEL, 'admin'), path.join(UIT, 'admin'));
kopieer(path.join(WORTEL, 'uploads'), path.join(UIT, 'uploads'));

console.log(`Klaar. ${artikelen.length} artikelen gebouwd:`);
for (const a of artikelen) console.log(`  /${a.slug}  —  ${a.titel}`);
