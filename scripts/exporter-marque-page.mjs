/**
 * Les marque pages de Bethel Dworp, en roumain et en français, au format Vistaprint (51 x 152 mm, recto verso).
 * Recto : la flamme, le nom de l'église, un verset sur la Parole. Verso : le programme de la semaine, l'adresse et le QR code du site.
 * Le programme et l'adresse viennent du site (app/sections/WeeklyProgram.jsx, app/translations). Les versets : Psaume 119:105,
 * Cornilescu pour le roumain, Louis Segond pour le français.
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
const NUIT = '#0a2a43', BLEU = '#164678', CLAIR = '#c9dcf2';
const textes = {
  ro: {
    eglise: 'Biserica Penticostală', verset: 'Cuvântul Tău este o candelă pentru picioarele mele și o lumină pe cărarea mea.', ref: 'Psalmul 119:105',
    accueil: 'Vă așteptăm în casa lui Dumnezeu', titre: 'Programul săptămânal',
    jours: [
      ['Luni', [['20:00', 'Seară de tineret și adolescenți']]],
      ['Marți', [['10:00', 'Zi de post și mijlocire'], ['20:00', 'Seară de rugăciune'], ['20:00', 'Repetiție orchestră']]],
      ['Miercuri', [['20:00', 'Repetiție cor mixt']]],
      ['Joi', [['20:00', 'Repetiție cor bărbătesc']]],
      ['Vineri', [['20:00', 'Seară de rugăciune']]],
      ['Sâmbătă', [['11:00', 'Program cu copii']]],
      ['Duminică', [['10:00', 'Serviciu divin'], ['18:00', 'Serviciu divin']]],
    ],
  },
  fr: {
    eglise: 'Église Pentecôtiste', verset: 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.', ref: 'Psaume 119:105',
    accueil: 'Nous vous attendons dans la maison de Dieu', titre: 'Programme de la semaine',
    jours: [
      ['Lundi', [['20:00', 'Soirée jeunes et adolescents']]],
      ['Mardi', [['10:00', 'Journée de jeûne et d’intercession'], ['20:00', 'Soirée de prière'], ['20:00', 'Répétition d’orchestre']]],
      ['Mercredi', [['20:00', 'Répétition chorale mixte']]],
      ['Jeudi', [['20:00', 'Répétition chorale des hommes']]],
      ['Vendredi', [['20:00', 'Soirée de prière']]],
      ['Samedi', [['11:00', 'Programme pour enfants']]],
      ['Dimanche', [['10:00', 'Culte'], ['18:00', 'Culte']]],
    ],
  },
};
const adresse = 'Alsembergsesteenweg 572B, 1653 Beersel';
const css = `*{box-sizing:border-box;margin:0;padding:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;color:#fff}
.page{position:relative;overflow:hidden;background:radial-gradient(120% 60% at 50% 0%,${BLEU},${NUIT} 70%)}
.serif{font-family:Baskerville,Georgia,serif;font-style:italic}`;
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

const flamme = `<img src="${url('public/icon.png')}" style="height:24mm;display:block;margin:0 auto;filter:drop-shadow(0 0 4mm rgb(255 120 90/.35)) brightness(1.25) saturate(1.1)">`;
const qr = fs.readFileSync('design/marque-page/qr-betheldworp.svg', 'utf8');

for (const [langue, t] of Object.entries(textes)) {
  rendre(`marque-page-${langue}-recto`, `
    <div style="position:absolute;inset:${BORD}mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:11mm 5mm 8mm">
      ${flamme}
      <p style="margin-top:5mm;font-size:2.3mm;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:${CLAIR}">${t.eglise}</p>
      <p style="margin-top:2mm;font-size:8.4mm;font-weight:800;letter-spacing:.1em;padding-left:.1em;line-height:1">BETHEL</p>
      <p style="margin-top:1.4mm;font-size:3.8mm;font-weight:300;letter-spacing:.5em;padding-left:.5em">DWORP</p>
      <span style="display:block;width:12mm;height:.3mm;margin:7mm 0 6mm;flex:none;background:rgb(255 255 255/.45)"></span>
      <p class="serif" style="font-size:4.3mm;line-height:1.36">${t.verset}</p>
      <p style="margin-top:3.4mm;font-size:2.4mm;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${CLAIR}">${t.ref}</p>
      <p style="margin-top:auto;font-size:2.5mm;line-height:1.4;color:${CLAIR}">${t.accueil}</p>
      <p style="margin-top:1.6mm;font-size:3.1mm;font-weight:700;letter-spacing:.04em">betheldworp.be</p>
    </div>`);
  rendre(`marque-page-${langue}-verso`, `
    <div style="position:absolute;inset:${BORD}mm;display:flex;flex-direction:column;padding:7.5mm 5mm 6.5mm">
      <p style="font-size:2.5mm;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:${CLAIR};text-align:center">Bethel Dworp</p>
      <p style="margin-top:1.5mm;font-size:4.6mm;font-weight:750;line-height:1.1;text-align:center">${t.titre}</p>
      <div style="margin-top:4mm;border-top:.25mm solid rgb(255 255 255/.22)">
        ${t.jours.map(([jour, liste]) => `<div style="padding:1.45mm 0;border-bottom:.25mm solid rgb(255 255 255/.22)"><p style="font-size:2.55mm;font-weight:750;letter-spacing:.06em;text-transform:uppercase">${jour}</p>${liste.map(([heure, quoi]) => `<p style="display:flex;gap:2mm;margin-top:.6mm;font-size:2.45mm;line-height:1.28;color:${CLAIR}"><b style="flex:none;width:6.8mm;color:#fff;font-weight:650">${heure}</b><span>${quoi}</span></p>`).join('')}</div>`).join('')}
      </div>
      <div style="margin-top:auto;padding-top:3mm;display:flex;align-items:center;gap:2.6mm">
        <div style="flex:none;width:14mm;height:14mm;padding:1.1mm;border-radius:1.6mm;background:#fff">${qr.replace('<svg', '<svg style="display:block;width:100%;height:100%"')}</div>
        <p style="font-size:2.3mm;line-height:1.4;color:${CLAIR}">${adresse.replace(', ', '<br>')}<br><b style="color:#fff;font-weight:700">betheldworp.be</b></p>
      </div>
    </div>`);
}
console.log('Marque pages prêts dans design/marque-page');
