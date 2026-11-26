# Supports imprimés de Bethel Dworp

## Marque pages (novembre 2026)

Format Vistaprint : 51 x 152 mm, recto verso. Une version en roumain et une en français.

1. Recto : la flamme, le nom de l'église et le Psaume 119:105 (Cornilescu en roumain, Louis Segond en français).
2. Verso : le programme de la semaine, l'adresse de l'église et un QR code vers betheldworp.be.

Les fichiers sont dans `design/marque-page` :

1. `marque-page-xx-recto-vistaprint.png` et `-verso-vistaprint.png` : à donner à l'atelier Vistaprint (avec 1,5 mm de fonds perdus).
2. `marque-page-xx-recto.pdf` et `-verso.pdf` : pour un autre imprimeur.
3. `marque-page-xx-recto.png` et `-verso.png` : aperçus au format fini.

La version roumaine est déjà montée dans l'atelier Vistaprint (Mes créations), rien n'est commandé.
Les aperçus pour une présentation sont dans `design/presentation`.

Si le programme change : modifier `scripts/exporter-marque-page.mjs`, puis `node scripts/exporter-marque-page.mjs` (Google Chrome requis).
