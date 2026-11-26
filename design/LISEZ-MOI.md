# Supports imprimés de Bethel Dworp

## Marque page (novembre 2026)

Format Vistaprint : 51 x 152 mm, recto verso, en roumain, dans le thème clair du site.

1. Recto : la flamme et le nom, le Psaume 119:105 (Cornilescu), l'invitation et le site.
2. Verso : le programme de la semaine, une ligne par rendez vous, l'adresse de l'église et un QR code vers betheldworp.be.

Les fichiers sont dans `design/marque-page` :

1. `marque-page-recto-vistaprint.png` et `marque-page-verso-vistaprint.png` : à donner à l'atelier Vistaprint (avec 1,5 mm de fonds perdus).
2. `marque-page-recto.pdf` et `marque-page-verso.pdf` : pour un autre imprimeur.
3. `marque-page-recto.png` et `marque-page-verso.png` : aperçus au format fini.

Il est déjà monté dans l'atelier Vistaprint (Mes créations), rien n'est commandé.
L'aperçu pour une présentation est `design/presentation/marque-page.webp`.

Si le programme change : modifier `scripts/exporter-marque-page.mjs`, puis `node scripts/exporter-marque-page.mjs` (Google Chrome requis).
