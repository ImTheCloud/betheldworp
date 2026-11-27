/**
 * Le marque page de Bethel Dworp, en roumain, au format Vistaprint (51 x 152 mm, recto verso), sur fond blanc.
 * Recto : la flamme, le nom de l'église, Efeseni 6:24, le grand QR code du site, www.betheldworp.be et l'adresse.
 * Verso : le grand titre, le programme du lundi au dimanche avec l'heure de début et de fin, et le petit QR code de la newsletter.
 * Le programme et l'adresse viennent du site (app/sections/WeeklyProgram.jsx). Les couleurs aussi : bleu nuit #0a2a43, bleu #164678.
 * PNG avec 1,5 mm de fonds perdus pour l'atelier Vistaprint, PDF pour un autre imprimeur, aperçu PNG au format fini.
 * A relancer si le programme change : node scripts/exporter-marque-page.mjs (Google Chrome requis, sur un Mac pour la police Hoefler Text).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = (p) => pathToFileURL(path.resolve(p)).href;
const NUIT = '#0a2a43', BLEU = '#164678', ROUGE = '#9f1d1d', DOUX = '#56677a', TRAIT = '#d9e1ea';
const SERIF = "'Hoefler Text','Baskerville',Georgia,serif";
const SANS = "-apple-system,'Helvetica Neue',sans-serif";
const verset = '„Harul să fie cu toți cei ce iubesc pe Domnul nostru Isus Hristos în curăție. Amin.”';
const reference = 'Efeseni 6:24';
// Le programme du site, du lundi au dimanche : le début, la fin et le nom de chaque rendez vous.
const semaine = [
  ['Luni', [['20:00', '21:30', 'Seară de tineret și adolescenți']]],
  ['Marți', [['10:00', '14:00', 'Zi de post și mijlocire'], ['20:00', '21:30', 'Seară de rugăciune'], ['20:00', '21:30', 'Repetiție orchestră']]],
  ['Miercuri', [['20:00', '21:30', 'Repetiție cor mixt']]],
  ['Joi', [['20:00', '21:30', 'Repetiție cor bărbătesc']]],
  ['Vineri', [['20:00', '21:30', 'Seară de rugăciune']]],
  ['Sâmbătă', [['11:00', '13:30', 'Program cu copii']]],
  ['Duminică', [['10:00', '12:00', 'Serviciu divin'], ['18:00', '20:00', 'Serviciu divin']]],
];
const adresse = 'Alsembergsesteenweg 572B, Beersel';
const css = `*{box-sizing:border-box;margin:0;padding:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{color:${NUIT};font-variant-numeric:lining-nums tabular-nums}
.page{position:relative;overflow:hidden;background:#fff}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bethel-marque-page-'));
const BORD = 1.5;

// l et h : le format fini en mm. Le dessin déborde de BORD mm de chaque côté.
function rendre(nom, corps, police, l = 51, h = 152, echelle = 4) {
  const dossier = 'design/marque-page';
  const L = l + 2 * BORD, H = h + 2 * BORD, f = path.join(temp, 'p.html');
  const px = (mm) => Math.round(mm * 96 / 25.4);
  const html = (bord) => `<!doctype html><meta charset="utf-8"><style>${css}body{font-family:${police}}@page{size:${L}mm ${H}mm;margin:0}.page{width:${L}mm;height:${H}mm;${bord}}</style><div class="page">${corps}</div>`;
  fs.writeFileSync(f, html(''));
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=4000', `--print-to-pdf=${path.resolve(dossier, `${nom}.pdf`)}`, `file://${f}`], { stdio: 'ignore' });
  // Le fichier à donner à Vistaprint : le format avec ses fonds perdus.
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${echelle}`, `--window-size=${px(L)},${px(H)}`, '--virtual-time-budget=4000', `--screenshot=${path.resolve(dossier, `${nom}-vistaprint.png`)}`, `file://${f}`], { stdio: 'ignore' });
  // L'aperçu, au format fini.
  fs.writeFileSync(f, html(`margin:-${BORD}mm`));
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${echelle}`, `--window-size=${px(l)},${px(h)}`, '--virtual-time-budget=4000', `--screenshot=${path.resolve(dossier, `${nom}.png`)}`, `file://${f}`], { stdio: 'ignore' });
}

const svg = (fichier) => fs.readFileSync(fichier, 'utf8').replace('<svg', '<svg style="display:block;width:100%;height:100%"');
const qrSite = svg('design/marque-page/qr-betheldworp.svg');
const qrNewsletter = svg('design/marque-page/qr-newsletter.svg');
const interieur = `position:absolute;inset:${BORD}mm`;
const filet = (marge) => `<span style="display:block;width:8mm;height:.3mm;background:${ROUGE};margin:${marge}"></span>`;

rendre('marque-page-recto', `
  <div style="${interieur};display:flex;flex-direction:column;align-items:center;text-align:center;padding:10mm 2.8mm 7mm">
    <img src="${url('public/icon.png')}" style="height:17mm;display:block">
    <p style="margin-top:5mm;font-size:2.4mm;letter-spacing:.22em;text-transform:uppercase;color:${DOUX}">Biserica Penticostală</p>
    <p style="margin-top:1.5mm;font-size:9.6mm;letter-spacing:.06em;line-height:1">BETHEL</p>
    <p style="margin-top:1mm;font-size:3.6mm;letter-spacing:.42em;padding-left:.42em;color:${BLEU}">DWORP</p>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center">
    ${filet('0')}
    <p style="margin-top:5mm;font-size:4.35mm;font-style:italic;line-height:1.34;text-wrap:balance">${verset}</p>
    <p style="margin-top:3mm;font-size:2.5mm;letter-spacing:.14em;text-transform:uppercase;color:${DOUX}">${reference}</p>
    </div>
    <div style="width:21mm;height:21mm">${qrSite}</div>
    <p style="margin-top:2.4mm;font-size:2.9mm;letter-spacing:.04em">www.betheldworp.be</p>
    <p style="margin-top:.8mm;font-size:2.2mm;color:${DOUX}">${adresse}</p>
  </div>`, SERIF);

// Une ligne : le jour, puis l'heure de début et de fin en bleu, et le rendez vous dessous.
const ligne = (jour, [debut, fin, quoi]) => `<div style="display:grid;grid-template-columns:12.4mm 1fr;column-gap:1.6mm;align-items:baseline">
  <span style="font-size:2.7mm;font-weight:700;color:${BLEU}">${jour}</span>
  <span><b style="display:block;font-size:2.7mm;font-weight:700;color:${BLEU};letter-spacing:.01em">${debut} la ${fin}</b><span style="display:block;margin-top:.3mm;font-size:2.7mm;line-height:1.25">${quoi}</span></span>
</div>`;

rendre('marque-page-verso', `
  <div style="${interieur};display:flex;flex-direction:column;padding:8.5mm 3mm 6mm">
    <p style="font-family:${SERIF};text-align:center;font-size:5.6mm;line-height:1.08">Programul<br>săptămânal</p>
    ${filet('3mm auto 1.5mm')}
    <div>${semaine.map(([jour, liste], rang) => `<div style="padding:1.45mm 0;${rang ? `border-top:.2mm solid ${TRAIT};` : ''}display:grid;gap:1.25mm">${liste.map((rdv, i) => ligne(i ? '' : jour, rdv)).join('')}</div>`).join('')}</div>
    <div style="margin-top:auto;display:flex;align-items:center;gap:2.6mm;padding-top:3mm;border-top:.2mm solid ${TRAIT}">
      <div style="flex:none;width:13mm;height:13mm">${qrNewsletter}</div>
      <div><p style="font-size:2.7mm;font-weight:700;color:${BLEU}">Newsletter</p><p style="margin-top:.5mm;font-size:2.3mm;line-height:1.35">Primește programul, noutățile și evenimentele viitoare pe e-mail.</p></div>
    </div>
  </div>`, SANS);
console.log('Marque page prêt dans design/marque-page');
