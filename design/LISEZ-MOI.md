# Supports imprimés de Bethel Dworp

## Marque page (novembre 2026)

Format Vistaprint : 51 x 152 mm, recto verso, en roumain, sur fond blanc.

1. Recto : la flamme, le nom de l'église, le verset Efeseni 6:24, un grand QR code vers www.betheldworp.be, le site et l'adresse.
2. Verso : le titre « Programul săptămânal », le programme du lundi au dimanche avec l'heure de début et de fin, et un petit QR code vers la newsletter (`qr-newsletter.svg`, www.betheldworp.be/ro#newsletter).

Une seconde version du recto porte les deux versets phares de l'église, Efeseni 6:23 et 6:24, sous le titre « Salutul bisericii noastre » : ce sont les versets que l'on confie aux invités pour leur église. Fichiers `marque-page-deux-versets-recto`, avec le même verso.

Les fichiers sont dans `design/marque-page` :

1. `marque-page-recto-vistaprint.png` et `marque-page-verso-vistaprint.png` : à donner à l'atelier Vistaprint (avec 1,5 mm de fonds perdus).
2. `marque-page-recto.pdf` et `marque-page-verso.pdf` : pour un autre imprimeur.
3. `marque-page-recto.png` et `marque-page-verso.png` : aperçus au format fini.

Il est déjà monté dans l'atelier Vistaprint (Mes créations), rien n'est commandé.
L'aperçu pour une présentation est `design/presentation/marque-page.webp`.

Si le programme change : modifier `scripts/exporter-marque-page.mjs`, puis `node scripts/exporter-marque-page.mjs` (Google Chrome requis).
