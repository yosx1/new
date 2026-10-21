// Builds the bilingual user guide: HTML → PDF with Chromium (correct Arabic shaping and RTL).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAPTERS, META } from './content.mjs';

const here = new URL('.', import.meta.url).pathname;
const [lang, out] = process.argv.slice(2);
const icon = readFileSync('/home/user/new/platform/public/icon.svg', 'utf8');
const img64 = n => 'data:image/jpeg;base64,' + readFileSync(`${here}shots/${n}.jpg`).toString('base64');

function part(lang) {
  const L = o => o[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const blocks = ch => ch.body.map(b => {
    if (b.p) return `<p>${L(b.p)}</p>`;
    if (b.h) return `<h3>${L(b.h)}</h3>`;
    if (b.who) return `<div class="who"><span>${L(META.who)}</span>${L(b.who)}</div>`;
    if (b.steps) return `<ol class="steps">${b.steps.map(s => `<li>${L(s)}</li>`).join('')}</ol>`;
    if (b.tip) return `<div class="box tip"><b>${L(META.tip)}</b><div>${L(b.tip)}</div></div>`;
    if (b.note) return `<div class="box note"><b>${L(META.note)}</b><div>${L(b.note)}</div></div>`;
    if (b.img) return `<figure class="${b.img.includes('phone') ? 'phone' : ''}"><img src="${img64(`${lang}-${b.img}`)}"><figcaption>${L(b.cap)}</figcaption></figure>`;
    if (b.table) return `<table><thead><tr>${b.table.head.map(h => `<th>${L(h)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map(c => `<td>${L(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return '';
  }).join('\n');
  return `
  <section class="part" dir="${dir}" lang="${lang}">
    <div class="cover">
      <div class="cover-net"></div>
      <div class="cover-in">
        <div class="logo">${icon}</div>
        <div class="lang-tag">${L(META.part)}</div>
        <h1>${L(META.title)}</h1>
        <h2>${L(META.sub)}</h2>
        <p class="plant">${L(META.plant)}</p>
        <p class="url" dir="ltr">${META.url}</p>
        <p class="date">${lang === 'ar' ? 'الإصدار' : 'Edition'} ${new Date().toISOString().slice(0, 10)}</p>
      </div>
    </div>
    <div class="toc">
      <h2>${L(META.contents)}</h2>
      <ol>${CHAPTERS.map((c, i) => `<li><span class="n">${i + 1}</span>${L(c.title)}</li>`).join('')}</ol>
    </div>
    ${CHAPTERS.map((c, i) => `<article class="chapter"><h2><span class="n">${i + 1}</span>${L(c.title)}</h2>${blocks(c)}</article>`).join('\n')}
  </section>`;
}

const css = `
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif; color: #142036; font-size: 10.6pt; line-height: 1.6; }
.part { page-break-before: always; }
.part:first-child { page-break-before: auto; }
.cover { position: relative; height: 262mm; margin: -16mm -15mm 0; padding: 0; overflow: hidden; color: #fff; page-break-after: always;
  background: linear-gradient(160deg, #0b2a5b, #164a9a 62%, #0b2a5b); }
.cover-net { position: absolute; inset: 0; background-image:
  radial-gradient(circle at 20% 30%, rgba(154,192,255,.9) 0 1.6px, transparent 2.2px), radial-gradient(circle at 70% 18%, rgba(154,192,255,.9) 0 1.6px, transparent 2.2px),
  radial-gradient(circle at 82% 64%, rgba(154,192,255,.9) 0 1.6px, transparent 2.2px), radial-gradient(circle at 35% 78%, rgba(154,192,255,.9) 0 1.6px, transparent 2.2px),
  radial-gradient(60% 50% at 85% 15%, rgba(21,101,216,.55), transparent 70%); }
.cover svg.lines { position: absolute; inset: 0; }
.cover-in { position: absolute; inset-inline: 22mm; bottom: 40mm; }
.logo svg { width: 30mm; height: 30mm; border-radius: 7mm; }
.lang-tag { display: inline-block; margin: 10mm 0 4mm; padding: 1.2mm 4mm; border: 1px solid rgba(255,255,255,.5); border-radius: 20mm; font-size: 10pt; letter-spacing: .4pt; }
.cover h1 { font-size: 34pt; margin: 0 0 3mm; line-height: 1.15; }
.cover h2 { font-size: 15pt; font-weight: 500; margin: 0 0 10mm; color: #dbe6fb; }
.cover p { margin: 1mm 0; color: #c7d6f3; font-size: 11pt; } .cover .url { font-weight: 600; color: #fff; }
.toc { page-break-after: always; }
.toc h2, .chapter h2 { color: #0b2a5b; font-size: 18pt; margin: 0 0 5mm; display: flex; align-items: center; gap: 3mm; }
.toc ol { list-style: none; padding: 0; margin: 0; columns: 1; }
.toc li { display: flex; align-items: center; gap: 3mm; padding: 2.4mm 0; border-bottom: 1px solid #e2e7ef; font-size: 11.5pt; }
.n { display: inline-grid; place-items: center; min-width: 8mm; height: 8mm; border-radius: 2.4mm; background: #e7f0ff; color: #1565d8; font-weight: 700; font-size: 10.5pt; }
.chapter { page-break-before: always; }
.toc + .chapter { page-break-before: auto; }
.chapter h2 { padding-bottom: 3mm; border-bottom: 2px solid #1565d8; }
h3 { color: #0d4cab; font-size: 12.5pt; margin: 6mm 0 2mm; }
p { margin: 0 0 3mm; }
.who { display: inline-flex; gap: 2mm; align-items: center; margin-bottom: 3mm; padding: 1mm 3mm; border-radius: 2mm; background: #eef0f4; font-size: 9.5pt; color: #344054; }
.who span { font-weight: 700; color: #0b2a5b; }
ol.steps { margin: 0 0 4mm; padding: 0; list-style: none; counter-reset: s; }
ol.steps li { counter-increment: s; position: relative; padding-inline-start: 9mm; margin-bottom: 2.4mm; }
ol.steps li::before { content: counter(s); position: absolute; inset-inline-start: 0; top: .3mm; width: 6mm; height: 6mm; border-radius: 50%; background: #1565d8; color: #fff; font-size: 8.5pt; font-weight: 700; display: grid; place-items: center; }
.box { display: flex; gap: 3mm; padding: 3mm 4mm; border-radius: 3mm; margin: 0 0 4mm; break-inside: avoid; font-size: 10pt; }
.box b { white-space: nowrap; }
.tip { background: #e7f0ff; color: #123f87; border-inline-start: 3px solid #1565d8; }
.note { background: #fff8e6; color: #6b4b00; border-inline-start: 3px solid #e0a800; }
figure { margin: 2mm 0 5mm; break-inside: avoid; }
figure img { width: 100%; border: 1px solid #d5dce7; border-radius: 2.5mm; box-shadow: 0 1mm 3mm rgba(16,34,64,.08); display: block; }
figure.phone img { width: 52mm; margin-inline: auto; }
figcaption { text-align: center; font-size: 9pt; color: #667085; margin-top: 1.5mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9.8pt; break-inside: auto; }
th { background: #0b2a5b; color: #fff; text-align: start; padding: 2mm 3mm; font-weight: 600; }
td { padding: 2mm 3mm; border-bottom: 1px solid #e2e7ef; vertical-align: top; }
tr { break-inside: avoid; }
td:first-child { font-weight: 600; width: 38%; }
b[dir=ltr] { unicode-bidi: isolate; }
`;

// A few network lines on the cover, drawn once so both parts match.
const lines = (() => {
  const pts = [[20,30],[38,22],[52,40],[70,18],[82,34],[64,56],[82,64],[46,70],[35,78],[18,60],[58,86],[90,82],[8,88]];
  const seg = [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[5,7],[7,8],[8,9],[9,0],[7,10],[6,11],[10,11],[8,12],[4,6]];
  return `<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none">${seg.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="rgba(120,170,250,.35)" stroke-width=".18"/>`).join('')}${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".45" fill="rgba(170,205,255,.9)"/>`).join('')}</svg>`;
})();

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${lang === 'ar' ? 'جاهزية التشغيل البارد — دليل المستخدم' : 'Cold Run Readiness — User Guide'}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${part(lang)}</body></html>`.replaceAll('<div class="cover-net"></div>', '<div class="cover-net"></div>' + lines);
writeFileSync(`${here}guide-${lang}.html`, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + here + `guide-${lang}.html`, { waitUntil: 'networkidle' }).catch(() => {});
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
console.log('fonts loaded:', [...new Set(fonts)].join(', ') || 'none');
await page.pdf({
  path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, preferCSSPageSize: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#8a94a6;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif">
    <span>Cold Run Readiness · جاهزية التشغيل البارد</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log('wrote', out);
