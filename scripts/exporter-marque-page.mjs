/**
 * Le marque page de Bethel Dworp, en roumain, au format Vistaprint (51 x 152 mm, recto verso), dans le thème clair du site.
 * Recto : la flamme et le nom, le Psaume 119:105 (Cornilescu), l'invitation et le site.
 * Verso : le programme de la semaine, une ligne par rendez vous, l'adresse et le QR code du site.
 * Le programme et l'adresse viennent du site (app/sections/WeeklyProgram.jsx, app/translations). Les couleurs aussi : bleu nuit #0a2a43, bleu #164678.
 * PNG avec 1,5 mm de fonds perdus pour l'atelier Vistaprint, PDF pour un autre imprimeur, aperçu PNG au format fini.
 * A relancer si le programme change : node scripts/exporter-marque-page.mjs (Google Chrome requis).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = (p) => pathToFileURL(path.resolve(p)).href;
const NUIT = '#0a2a43', BLEU = '#164678', DOUX = '#5b6b7c', PASTILLE = '#e3edf8', TRAIT = '#e2e8f0', FOND = '#f4f7fb', FLAMME = '#9f1d1d';
const verset = 'Cuvântul Tău este o candelă pentru picioarele mele și o lumină pe cărarea mea.';
const reference = 'Psalmul 119:105';
// Le programme du site, une ligne par rendez vous. Les noms sont ceux du site, raccourcis seulement quand le jour le dit déjà.
const semaine = [
  ['Lun', [['20:00', 'Tineret și adolescenți']]],
  ['Mar', [['10:00', 'Zi de post și mijlocire'], ['20:00', 'Seară de rugăciune'], ['20:00', 'Repetiție orchestră']]],
  ['Mie', [['20:00', 'Repetiție cor mixt']]],
  ['Joi', [['20:00', 'Repetiție cor bărbătesc']]],
  ['Vin', [['20:00', 'Seară de rugăciune']]],
  ['Sâm', [['11:00', 'Program cu copii']]],
  ['Dum', [['10:00', 'Serviciu divin'], ['18:00', 'Serviciu divin']]],
];
const adresse = ['Alsembergsesteenweg 572B', '1653 Beersel'];
const css = `*{box-sizing:border-box;margin:0;padding:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;color:${NUIT};font-variant-numeric:tabular-nums}
.page{position:relative;overflow:hidden;background:#fff}
.titre{font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bethel-marque-page-'));
const BORD = 1.5;

// l et h : le format fini en mm. Le dessin déborde de BORD mm de chaque côté.
function rendre(nom, corps, l = 51, h = 152, echelle = 4) {
  const dossier = 'design/marque-page';
  const L = l + 2 * BORD, H = h + 2 * BORD, f = path.join(temp, 'p.html');
  const px = (mm) => Math.round(mm * 96 / 25.4);
  const html = (bord) => `<!doctype html><meta charset="utf-8"><style>${css}@page{size:${L}mm ${H}mm;margin:0}.page{width:${L}mm;height:${H}mm;${bord}}</style><div class="page">${corps}</div>`;
  fs.writeFileSync(f, html(''));
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=4000', `--print-to-pdf=${path.resolve(dossier, `${nom}.pdf`)}`, `file://${f}`], { stdio: 'ignore' });
  // Le fichier à donner à Vistaprint : le format avec ses fonds perdus.
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${echelle}`, `--window-size=${px(L)},${px(H)}`, '--virtual-time-budget=4000', `--screenshot=${path.resolve(dossier, `${nom}-vistaprint.png`)}`, `file://${f}`], { stdio: 'ignore' });
  // L'aperçu, au format fini.
  fs.writeFileSync(f, html(`margin:-${BORD}mm`));
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${echelle}`, `--window-size=${px(l)},${px(h)}`, '--virtual-time-budget=4000', `--screenshot=${path.resolve(dossier, `${nom}.png`)}`, `file://${f}`], { stdio: 'ignore' });
}

// Le logo du site : la flamme, et le nom sur deux lignes à côté.
const logo = (taille) => `<div style="display:flex;align-items:center;gap:${taille * 0.32}mm"><img src="${url('public/icon.png')}" style="height:${taille * 1.55}mm;display:block"><div class="titre" style="font-size:${taille * 0.5}mm;font-weight:800;letter-spacing:.2em;line-height:1.12">BETHEL<br>DWORP</div></div>`;
const qr = fs.readFileSync('design/marque-page/qr-betheldworp.svg', 'utf8').replace('<svg', '<svg style="display:block;width:100%;height:100%"');
const interieur = `position:absolute;inset:${BORD}mm`;

rendre('marque-page-recto', `
  <div style="${interieur};display:flex;flex-direction:column;padding:9mm 5.5mm 0">
    <div style="display:flex;justify-content:center">${logo(7)}</div>
    <div style="margin-top:auto;margin-bottom:auto">
      <span style="display:block;width:9mm;height:.7mm;border-radius:.4mm;background:${FLAMME}"></span>
      <p class="titre" style="margin-top:4.5mm;font-size:5.5mm;font-weight:700;line-height:1.2;letter-spacing:-.015em">„${verset}”</p>
      <p style="margin-top:4mm;font-size:2.35mm;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${BLEU}">${reference}</p>
    </div>
    <div style="margin:0 -5.5mm;padding:5.5mm 5.5mm 7mm;background:${FOND};border-top:.3mm solid ${TRAIT}">
      <p style="font-size:2.5mm;line-height:1.4;color:${DOUX}">Vă așteptăm în casa lui Dumnezeu.</p>
      <p class="titre" style="margin-top:1.2mm;font-size:3.4mm;font-weight:800;letter-spacing:-.01em">betheldworp.be</p>
    </div>
  </div>`);

const ligne = (jour, heure, quoi, premier) => `<div style="display:grid;grid-template-columns:5.3mm 8.4mm 1fr;align-items:center;column-gap:1.1mm;padding:1.45mm 0">
  <span style="font-size:1.95mm;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${DOUX}">${premier ? jour : ''}</span>
  <span style="justify-self:start;padding:.55mm 1.15mm;border-radius:1.2mm;background:${PASTILLE};font-size:2.05mm;font-weight:700;color:${BLEU}">${heure}</span>
  <span style="font-size:2.14mm;font-weight:600;line-height:1.2;letter-spacing:-.01em;white-space:nowrap">${quoi}</span>
</div>`;

rendre('marque-page-verso', `
  <div style="${interieur};display:flex;flex-direction:column;padding:8mm 3.2mm 0">
    <div style="display:flex;justify-content:center">${logo(5)}</div>
    <p class="titre" style="margin-top:5.5mm;font-size:5.2mm;font-weight:800;line-height:1.05;letter-spacing:-.02em;text-align:center">Programul<br>săptămânal</p>
    <div style="margin:auto 0;padding:1.2mm 1.9mm;border:.3mm solid ${TRAIT};border-radius:2.4mm;background:#fff;box-shadow:0 .6mm 1.6mm rgb(10 42 67/.06)">
      ${semaine.map(([jour, liste], rang) => `<div style="${rang ? `border-top:.25mm solid ${TRAIT}` : ''}">${liste.map(([heure, quoi], i) => ligne(jour, heure, quoi, i === 0)).join('')}</div>`).join('')}
    </div>
    <div style="margin:0 -3.2mm;padding:4.5mm 4mm 6.5mm;display:flex;align-items:center;gap:2.6mm;background:${FOND};border-top:.3mm solid ${TRAIT}">
      <div style="flex:none;width:13mm;height:13mm;padding:1mm;border-radius:1.6mm;background:#fff;border:.25mm solid ${TRAIT}">${qr}</div>
      <div><p style="font-size:2.05mm;line-height:1.45;letter-spacing:-.01em;white-space:nowrap;color:${DOUX}">${adresse.join('<br>')}</p><p class="titre" style="margin-top:.8mm;font-size:2.7mm;font-weight:800">betheldworp.be</p></div>
    </div>
  </div>`);
console.log('Marque page prêt dans design/marque-page');
