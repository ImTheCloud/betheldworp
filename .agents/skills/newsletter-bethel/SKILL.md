---
name: newsletter-bethel
description: >
  Crée la newsletter hebdomadaire de Bethel Dworp pour la semaine prochaine.
  Active ce skill quand l'utilisateur demande de créer la newsletter, le programme de la semaine,
  ou mentionne "newsletter", "programul săptămânii", "Brevo", ou "email de la semaine".
---

# Newsletter Hebdomadaire Bethel Dworp

## Vue d'ensemble

Chaque dimanche, on crée une newsletter HTML pour la semaine suivante contenant le programme de l'église Bethel Dworp. Le fichier est ensuite copié-collé dans Brevo pour l'envoi.

---

## 1. Informations à demander à l'utilisateur

Avant de commencer, demande TOUJOURS :

1. **Quels sont les événements spéciaux cette semaine ?** (ex: Cina Domnului, Binecuvântare de copii, visite d'un prédicateur, etc.)
2. **Y a-t-il des programmes annulés ?** (ex: programme des enfants du samedi, programme du soir de dimanche, etc.)
3. **Y a-t-il des changements aux horaires habituels ?**

---

## 2. Programme standard de la semaine

Voici le programme récurrent (ne change quasi jamais) :

| Jour | Heure | Événement |
|------|-------|-----------|
| **Lundi (LUN)** | 20:00 – 21:30 | Seară de Tineret și Adolescenți |
| **Marți (MAR)** | 10:00 – 14:00 | Zi de post și mijlocire |
| **Marți (MAR)** | 20:00 – 21:30 | Seară de rugăciune |
| **Marți (MAR)** | 20:00 – 21:30 | Repetiție Orchestră (la subsol, séparée de la soirée de prière) |
| **Miercuri (MIE)** | 20:00 – 21:30 | Repetiția corului mixt |
| **Joi (JOI)** | 20:00 – 21:30 | Repetiția corului bărbătesc |
| **Vineri (VIN)** | 20:00 – 21:30 | Seară de rugăciune |
| **Sâmbătă (SÂM)** | 11:00 – 13:30 | Program cu copiii |
| **Duminică (DUM)** | 10:00 – 12:00 | Serviciu Divin de dimineață |
| **Duminică (DUM)** | 18:00 – 20:00 | Serviciu Divin de seară |

---

## 3. Événements spéciaux récurrents

### 🍞 Cina Domnului (Sainte-Cène) & Zi de post

Quand il y a Cina Domnului un dimanche :
- **Image principale** : `https://www.betheldworp.be/images/events/supper.jpg`
- **Dimanche matin** devient un chip vert spécial (`chip-s`) : `10:00 – 12:30` → "Cina Domnului în cadrul slujbei"
- Ajouter un badge **Pauză ~ 1h** après la première partie
- Puis `13:30 – 16:00` → "Reluăm programul bisericii"
- **Dimanche soir ANULAT, TOUJOURS** (chip rouge `chip-c`) avec note "Datorită zilei de post" : c'est une règle de l'église pour chaque « Cina Domnului și zi de post », sans exception. Dans l'admin : Program Overrides, Sunday PM = Cancelled. Le texte de l'événement le dit explicitement dès la première phrase (« Programul de seară (18:00) este anulat, datorită zilei de post. »). L'écran Weekly Email avertit si le soir n'est pas annulé.
- **Section détaillée** avec le texte suivant :

```
Pentru biserică, este o zi specială: va fi o zi de post până la aproximativ 16:00.

De la 10:00 până în jur de 12:30 va fi Cina Domnului în cadrul slujbei (orele sunt orientative, prima parte nu se încheie fix la 12:30). Prin acest act de credință ne amintim de sacrificiul pe care Domnul Isus Hristos l-a făcut pe crucea de la Golgota.

După o pauză de aproximativ o oră, reluăm programul bisericii la ora 13:30 până în jur de ora 16:00.

Programul de seară (18:00) nu va avea loc datorită zilei de post.
```

- **Verset** : 1 Corinteni 11:26
  > „Căci ori de câte ori mâncați pâinea aceasta și beți paharul acesta, vestiți moartea Domnului, până va veni El."

### 👶 Binecuvântare de copii

- **Image** : `https://www.betheldworp.be/images/events/children.jpg`
- Voir la newsletter `newsletter_2026-10-12.html` pour le texte complet et le verset (Numeri 6:24-26)

---

## 4. Disposition et styles visuels du calendrier (Boîtes jour compactes à gauche)

### Disposition en 2 colonnes avec boîte compacte :
Pour concilier l'esthétique appréciée des boîtes de calendrier à gauche et laisser un maximum d'espace pour le texte descriptif sur mobile :
- **Colonne de gauche** : `<td width="56" valign="top" style="padding:14px 0;border-bottom:1px solid #eef2f6;">`
- **Boîte jour (`chip-s`, `chip-c`, `chip-n`)** :
  - Dimensions compactes et équilibrées : `width:52px;border-radius:10px;padding:6px 0 5px;text-align:center;`
  - Nom complet du jour en micro-typographie ultra-nette : `font-size:8px;font-weight:900;letter-spacing:0.2px;line-height:1.1;white-space:nowrap;text-transform:uppercase;`
  - Chiffre de la date bien visible : `font-size:19px;font-weight:900;line-height:1.15;padding-top:1px;`
- **Colonne de droite (contenu de l'événement)** :
  - Gouttière resserrée : `<td valign="top" style="padding:14px 0 14px 12px;border-bottom:1px solid #eef2f6;">`
  - Cela libère plus de 22px de largeur supplémentaire pour le texte par rapport à une boîte large, évitant les retours à la ligne intempestifs sur mobile tout en conservant le style visuel emblématique en carte.

### Noms des jours en entier :
Toujours écrire le nom du jour **en entier** dans le haut de la boîte (`LUNI`, `MARȚI`, `MIERCURI`, `JOI`, `VINERI`, `SÂMBĂTĂ`, `DUMINICĂ`) et **JAMAIS** en abrégé (`LUN`, `MAR`, `MIE`, `VIN`, `SÂM`, `DUM`).

Il y a 3 types de boîtes (chips) dans le calendrier :

| Type | Classe CSS | Couleur | Utilisation |
|------|-----------|---------|-------------|
| **Normal** | `chip-n` | Gris sur fond `#f1f5f9`, bordure `#e2e8f0`, texte `#64748b` | Programme standard |
| **Spécial** | `chip-s` | Vert `#16a34a` sur fond `#dcfce7`, bordure `#86efac` | Événement spécial (Cina Domnului, invité, etc.) |
| **Annulé** | `chip-c` | Rouge `#dc2626` sur fond `#fee2e2`, bordure `#fca5a5` | Programme annulé |

Pour un événement **annulé**, respecter la structure normale (ne JAMAIS tout compacter sur une seule ligne comme `Program cu copiii (11:00) : ANULAT`) :
- **L'heure au-dessus** (en rouge `t-cancel`)
- **Le titre de l'activité en-dessous** (en rouge `t-cancel`)
- **La mention ANULAT en-dessous** (en rouge `t-cancel`)
- *(Optionnel)* La note d'explication si le programme est déplacé (ex: `(Mutată miercuri, 11 noiembrie)`)

```html
<div class="t-cancel" style="font-size:13px;font-weight:800;color:#dc2626;">
    <span class="no-detect">11&zwnj;:00 – 13&zwnj;:30</span>
</div>
<div class="t-cancel" style="font-size:15px;color:#dc2626;font-weight:700;line-height:1.45;padding-top:3px;">
    Program cu copiii
</div>
<div class="t-cancel" style="font-size:13px;color:#dc2626;font-weight:800;letter-spacing:0.5px;padding-top:2px;">
    ANULAT
</div>
```

### Statuts : même vocabulaire que le site

Depuis novembre 2026, le programme hebdomadaire du site affiche un statut sur chaque créneau qui sort de l'ordinaire (languette sur le bord de la carte, bordure et coin « ↗ » de la même couleur), et un résumé au-dessus de la grille. Le titre du résumé s'adapte : « Evenimente în această săptămână » s'il n'y a que des événements, « Schimbări în această săptămână » s'il n'y a que des changements, « Schimbări și evenimente în această săptămână » s'il y a les deux. La newsletter reprend **les mêmes mots**, pour que les gens retrouvent la même information partout.

| Statut | Quand | Rendu dans la newsletter |
|--------|-------|--------------------------|
| **ANULAT** | Créneau annulé, rien ne le remplace | `chip-c` rouge, heure + titre + `ANULAT` en rouge (voir plus haut) |
| **MUTAT** | Activité déplacée d'un jour à l'autre (ex. post de marți à miercuri) | Jour de départ : c'est d'abord une annulation, donc `chip-c` rouge, heure + titre + `ANULAT` en rouge, puis la note `Mutat miercuri, 11 noiembrie`. Jour d'arrivée : `chip-s` vert, pastille `MUTAT` à côté de l'heure, note `Mutat de marți` (ajouter `, în locul: …` si l'activité prend la place d'un autre programme, ex. lundi le cor bărbătesc à la place de la soirée des jeunes) |
| **EVENIMENT** | Créneau remplacé par un événement (invité, concert, baptême) | `chip-s` vert, pastille `EVENIMENT` à côté de l'heure, titre de l'événement, ligne verte `Invitat special: …` si besoin, note `În locul: Serviciu Divin` si utile |
| **MODIFICAT** | Titre ou heure changés pour une autre raison | `chip-s` vert, pastille `MODIFICAT` à côté de l'heure, note courte qui dit ce qui change (ex. `În locul serii de tineret`) |
| **PROGRAM SPECIAL** (ex-Extra) | Réunion qui n'existe pas d'habitude (ex. un culte un jeudi), en plus du programme | `chip-s` vert, pastille `PROGRAM SPECIAL` à côté de l'heure |
| **EVENIMENT** (2e événement) | Deux événements dans le même programme (ex. Cina Domnului et bénédiction des enfants le même dimanche matin) | Une seule ligne dans le calendrier : l'**événement principal**. Le second n'a pas de ligne, il est annoncé après le calendrier (« Tot în această săptămână »). Ce n'est **jamais** un Program special. Même règle sur le site : une seule carte dans le programme de la semaine, mais le résumé « Schimbări și evenimente » liste aussi le second (et un troisième) juste sous le principal ; le calendrier du mois montre les deux, le principal en premier |
| **NOU** | Activité qui entre dans le programme régulier (ex. orchestre, novembre 2026) | `chip-s` vert, pastille `NOU` à côté de l'heure, **uniquement la première semaine** |

**Pastille à côté de l'heure** (même ligne que l'heure, donc aucune hauteur en plus sur mobile). Exemple pour `NOU`, voir `newsletter_2026-11-16.html` :

```html
<span class="badge-nou"
    style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background-color:#dcfce7;border:1px solid #86efac;color:#15803d;font-size:10px;font-weight:900;letter-spacing:0.6px;line-height:1.4;vertical-align:1px;">NOU</span>
```

`ANULAT` n'a pas de pastille : il reste écrit en rouge sous le titre, comme avant. Couleurs des pastilles, identiques au site : `ANULAT` rouge (`#fdecec`, `#f3b4b4`, `#b91c1c`) si jamais une pastille est nécessaire, `MUTAT` / `MODIFICAT` jaune (`#fcf1da`, `#f0c76a`, `#92600a`), `NOU` / `PROGRAM SPECIAL` vert (`#dcfce7`, `#86efac`, `#15803d`), `EVENIMENT` bleu (`#dde9fb`, `#93b4ef`, `#0f4c8a`). Toujours ajouter la règle du mode sombre de la classe (`@media (prefers-color-scheme: dark)` et `[data-ogsc]` / `[data-ogsb]`), comme pour `.badge-nou`.

**Comment le site décide du statut** (à connaître pour vérifier que site et newsletter disent la même chose). Tout vient de l'admin, section Program overrides :
- `Main Program` sur `Cancelled` : **Anulat**.
- `Main Program` sur un événement : **Eveniment**.
- `Manual Text Override` (titre ou heure) : **Modificat**.
- `Second Event (same program)` : second événement pendant le même programme (champ `alsoEvents`). Pas de carte à lui dans le programme de la semaine : seul l'événement principal (`Main Program`) y figure. Dans l'admin Événements, lier un 2e événement à un créneau déjà pris l'ajoute ici au lieu de remplacer le premier.
- `Special Program (extra)` : **Program special** (ex-Extra), réunion en plus du programme habituel.
- **Mutat est détecté tout seul** : un créneau annulé dont le titre habituel est écrit à la main sur un autre créneau de la même semaine. Le jour de départ affiche **Anulat** (note `Mutat miercuri`), le jour d'arrivée **Mutat** (note `Mutat de marți`). Il suffit d'annuler mardi matin et d'écrire « Zi de post și mijlocire » sur le créneau de mercredi.
- `Note for visitors` (RO, FR, NL, EN) : texte court affiché sous le titre de la carte et dans le résumé. Il remplace la note automatique (`Mutat miercuri`, `Mutat de marți`).
- Dans le résumé, le site ajoute de lui-même ce qu'une modification remplace : `în locul: Seară de Tineret și Adolescenți`. La newsletter peut reprendre la même formule dans la note.
- **Pour un vrai remplacement par un invité, un concert ou un baptême, créer un événement** et le choisir dans `Main Program` (statut Eveniment). Garder `Manual Text Override` pour les changements du programme habituel (statut Modificat ou Mutat).

---

## 5. Structure du fichier HTML & Règles de contenu

### ⚠️ RÈGLES FONDAMENTALES :

1. **Hiérarchie de l'événement en tête (avant le calendrier)** :
   Quand la semaine comporte un événement phare (invité, orchestre, concert, etc.), il est placé **directement au début**, avant le calendrier, dans cet ordre strict :
   - **Titre de l'événement** en grand (`.h1`, ex: `Orchestra Bisericii Elim Bruxelles în mijlocul nostru`)
   - **Date & Heure** juste en-dessous en sous-titre vert sobre (`.t-accent`, ex: `Duminică, 8 Noiembrie, 18:00 – 20:00`). **Ne JAMAIS mettre** de mention superflue comme *"Evenimentul săptămânii"* ni de parenthèses encombrantes autour des heures.
   - **Salutation** ensuite : `Pacea Domnului, dragi frați și surori,` placée **au-dessus du texte de présentation** (donc en-dessous du titre de l'événement).
   - **Texte de présentation** fraternel et naturel.

2. **Aucun verset sans demande expresse** :
   - Ne **JAMAIS** ajouter de verset biblique dans la newsletter **sauf si l'utilisateur le demande explicitement**.
   - Ne pas ajouter de verset par défaut, ni inventer un verset pour meubler.

3. **Zéro répétition d'informations** :
   - L'image de l'événement phare s'affiche **une seule fois** (en grand comme image principale sous le bandeau date). Ne **JAMAIS** réafficher la même image plus bas.
   - Le texte explicatif est donné une seule fois au début. Le calendrier se contente ensuite de mentionner le nom de l'événement sur le jour J avec le badge vert (`chip-s`).
   - Ne **PAS** créer de section dupliquée après le calendrier qui répète l'image ou le texte. Le calendrier enchaîne directement vers le bouton CTA et la conclusion (sauf s'il y a un 2e événement distinct, ex: protestation le samedi ET culte spécial le dimanche).

4. **Zéro caractère séparateur (AUCUN tiret `-`, AUCUN point médian `·`, AUCUNE puce `•`, RIEN)** :
   - Ne **JAMAIS** insérer de point médian `·`, de puce `•` ou de tiret `-` / `–` pour séparer des fragments de texte, titres, sous-titres, dates, lieux, tags ou notes (ex: INTERDIT `(Mutată din ziua de marți · Zi de sărbătoare legală)`, `15 Noiembrie · 10:00`, `20:00 · Program Extra`, `Serviciu – Invitat`).
   - L'utilisateur préfère **ne rien avoir** plutôt que ce genre d'éléments. Trouver une autre variante sans aucun caractère séparateur : retour à la ligne (`<br/>` ou `<div>`), virgule naturelle, ou phrase simple sans juxtaposer des mentions superflues.

5. **Style d'écriture propre, naturel et sans clichés ("cu căldură", etc.)** :
   - Ne **JAMAIS** utiliser des expressions lourdes ou clichées comme *"cu căldură"* (*"vă invităm cu căldură"*, *"invitați cu căldură"*).
   - Utiliser des formulations simples et directes : *"vă invităm să participați"*, *"vă așteptăm cu drag"*, *"toți cei care cântă la un instrument sunt invitați să participe"*.

6. **Activités se déroulant pendant le culte / la soirée de prière habituelle** :
   - Si une activité spéciale **ponctuelle** (ex: adunare administrativă) a lieu pendant le programme du soir habituel, ce n'est **PAS** un "Program Extra" distinct.
   - Ne pas dupliquer le bloc horaire : présenter le créneau unique en précisant que l'activité a lieu dans le cadre de la soirée de l'église.
   - **Exception : la répétition d'orchestre du mardi** fait partie du programme hebdomadaire depuis le 17 novembre 2026. Elle a sa propre ligne dans le calendrier (`Repetiție Orchestră`, `chip-n`), juste après `Seară de rugăciune` du mardi soir.

7. **Pas de retour sur les anciens événements ou verset du mois déjà annoncé** :
   - Ne **PAS** répéter le "Versetul lunii" ou des annonces passées si elles ont déjà été communiquées dans une newsletter précédente.
   - Chaque newsletter doit être fraîche, épurée et concentrée à 100% sur les nouveautés de la semaine en cours.

### Ordre des sections du fichier :

1. **`<head>`** — CSS identique à chaque fois (light/dark mode, responsive, Outlook fixes)
2. **Preheader** — Texte caché résumant les événements de la semaine
3. **Section 1 : En-tête** — Logo Bethel Dworp + lien site
4. **Section 2 : Bandeau date** — Fond vert `#16a34a` avec la plage de dates
5. **Section 3 : Image principale** — Image de l'événement phare de la semaine (ou drone par défaut si semaine standard)
6. **Section 4 : Événement phare en tête** :
   - Titre de l'événement (`.h1`)
   - Date & Heure sobre (`.t-accent`)
   - `Pacea Domnului, dragi frați și surori,`
   - Texte de présentation de l'événement
7. **Section 5 : Calendrier** — Tableau avec tous les jours de la semaine (badge vert `chip-s` pour l'événement spécial)
8. **Section 6 : Événement secondaire éventuel** *(uniquement s'il y a un 2e événement distinct non couvert au début)*
9. **Section 7 : Bouton CTA** — "Vezi toate evenimentele pe site"
10. **Section 8 : Salut final** — "Echipa Bethel Dworp"
11. **Section 9 : Footer** — Mentions légales + lien désabonnement `{{ unsubscribe }}`

---

## 6. Convention de nommage

```
Newsletter template/newsletter_YYYY-MM-DD.html
```

Où `YYYY-MM-DD` est le **lundi** de la semaine concernée (premier jour de la semaine du programme).

---

## 7. Créer le fichier

### Méthode automatique (depuis novembre 2026, à privilégier)

La newsletter est générée par le site à partir du programme (`program_overrides`) et des événements, avec le même calcul de statuts que le site (`app/lib/weekProgram.js`). Plus rien à copier à la main :

- **Admin → Weekly Email** (`/admin#weekly`, pensé pour le téléphone) : choix de la semaine, aperçu clair et sombre, événement en tête, message de la semaine facultatif, objet et texte d'aperçu modifiables, bouton « Trimite test » (à l'adresse de l'admin) et « Trimite newsletter-ul » avec confirmation (objet, liste, nombre de destinataires).
- **Dimanche soir** : une tâche planifiée Vercel (`/api/cron/newsletter`, `vercel.json`) envoie une notification ntfy avec le lien vers l'aperçu. Elle n'envoie **jamais** rien aux abonnés.
- **Jamais deux fois** : chaque envoi crée dans Brevo une liste `Newsletter 2026-W48 #1` (dossier « Newsletter trimis ») avec exactement ses destinataires. Après un ajout tardif, le même bouton n'envoie qu'aux abonnés qui ne l'ont pas encore reçue (`#2`). Ne pas supprimer ces listes tant que la semaine n'est pas passée.
- **Destinataires** : abonnés actifs dans Firestore (`newsletter`) ET joignables dans Brevo. Un contact présent seulement dans Brevo, ou bloqué dans Brevo, ne reçoit rien.
- Code : `app/lib/newsletter/` (données, rendu, envoi), routes `app/api/newsletter/weekly/*`. En local, aucun envoi n'est possible (`sendingAllowed`).
- Pour changer le texte d'un événement, modifier l'événement dans l'admin : la newsletter reprend son texte roumain (sans la ligne « Pacea Domnului », la newsletter salue déjà).

La méthode manuelle ci-dessous reste valable pour une newsletter exceptionnelle.

### Méthode manuelle :

1. **Copier la dernière newsletter** comme base
2. **Mettre à jour** :
   - Le `<title>` avec les nouvelles dates
   - Le **preheader** (texte caché) avec le résumé de la semaine
   - La **bandeau date** (section 2) avec la plage `DD – DD Mois 2026`
   - L'**image principale** (section 3) selon l'événement phare
   - L'**introduction** (section 4) avec les événements spéciaux mentionnés
   - Les **numéros de jour** dans tous les chips du calendrier
   - Les **sections détaillées** (ajouter/supprimer selon les événements)
3. **Chercher dans les anciennes newsletters** si un événement similaire a déjà eu lieu (pour réutiliser les textes et images)

### Anciennes newsletters avec événements spéciaux :

| Événement | Newsletter de référence |
|-----------|----------------------|
| Cina Domnului & Zi de post | `newsletter_2026-09-21.html` |
| Binecuvântare de copii | `newsletter_2026-10-12.html` |
| Protest Familia Samson | `newsletter_2026-10-12.html` |
| Visite prédicateur (Simion Buzduga) | `newsletter_2026-09-21.html` |

---

## 8. Envoi via Brevo

### Configuration de la campagne :

| Champ | Valeur |
|-------|--------|
| **Expéditeur** | Bethel Dworp · info@betheldworp.be |
| **Destinataires** | 27 destinataires (liste newsletter Bethel) |
| **Objet** | `Programul săptămânii (DD - DD mois)` + résumé des événements spéciaux |
| **Texte d'aperçu** | Résumé court des événements phares de la semaine |

### Étapes dans Brevo :

1. Aller sur [app.brevo.com](https://app.brevo.com) → **Campagnes** → **Créer une campagne email**
2. **Expéditeur** : Bethel Dworp (info@betheldworp.be) — déjà configuré
3. **Destinataires** : Sélectionner la liste des abonnés newsletter
4. **Objet de la campagne** :
   - **Objet** : `Programul săptămânii (DD - DD mois)` suivi du résumé (ex: `Cina Domnului & Zi de post`)
   - **Texte d'aperçu** : Description courte (ex: `Programul complet al bisericii: Cina Domnului duminică, program copii anulat sâmbătă.`)
5. **Design** :
   - Cliquer sur **Modifier le design**
   - Choisir **Coder votre propre design** (éditeur HTML)
   - **Coller le contenu HTML** du fichier newsletter créé
   - Vérifier l'aperçu mobile et desktop
6. **Envoyer** ou **Programmer** l'envoi

### ⚠️ Points d'attention Brevo :
- Le placeholder `{{ unsubscribe }}` sera automatiquement remplacé par Brevo avec le lien de désabonnement
- Toujours faire un **envoi test** à soi-même avant l'envoi final
- Les images doivent être hébergées sur `www.betheldworp.be` (elles le sont déjà)

---

## 9. Checklist finale

Avant d'envoyer, vérifier :

- [ ] **Hiérarchie respectée** : Titre de l'événement en premier, date/heure sobre en-dessous, puis `Pacea Domnului, dragi frați și surori,` au-dessus du texte
- [ ] **Aucun verset non demandé** : Ne pas afficher de verset sauf demande expresse de l'utilisateur
- [ ] **Zéro répétition** : Aucune image ou texte n'est dupliqué dans la newsletter
- [ ] **Pas d'anciens événements** : Pas de verset du mois ou d'événement passé déjà annoncé dans les newsletters précédentes
- [ ] Les **dates** sont correctes partout (title, bandeau, calendrier, sections)
- [ ] Les **numéros de jour** correspondent au bon jour de la semaine
- [ ] Les **événements spéciaux** sont bien marqués en vert (`chip-s`)
- [ ] Les **programmes annulés** sont bien en rouge (`chip-c`) avec mention "ANULAT"
- [ ] Les **statuts** (ANULAT, MUTAT, EVENIMENT, MODIFICAT, PROGRAM SPECIAL, NOU) correspondent à ce qu'affiche le site pour la même semaine
- [ ] L'**image principale** correspond à l'événement phare (ou drone si semaine standard)
- [ ] Le **preheader** résume bien la semaine
- [ ] L'**objet Brevo** est clair et résume les points forts
- [ ] Un **envoi test** a été fait

---

## 10. Images disponibles

| Image | URL | Utilisation |
|-------|-----|-------------|
| Vue drone église | `https://www.betheldworp.be/images/landing_page/drone.jpg` | Semaine standard |
| Cina Domnului | `https://www.betheldworp.be/images/events/supper.jpg` | Semaine avec Cina Domnului |
| Enfants | `https://www.betheldworp.be/images/events/children.jpg` | Binecuvântare de copii |
| Protest Samson | `https://www.betheldworp.be/images/events/ProtestSamson.jpeg` | Protest Familia Samson |
| Simion Buzduga | `https://www.betheldworp.be/images/events/SimionBuzduga.png` | Visite fr. Simion |
| Orchestra Elim Bruxelles | `https://www.betheldworp.be/images/events/OrchestraElimBruxelles.jpg` | Visite / concert Orchestra Elim Bruxelles |
| Orchestre de l'église | `https://www.betheldworp.be/images/events/Orchestra.jpg` | Répétition d'orchestre du mardi |

---

## 11. Commit & Push

Après avoir créé la newsletter, **toujours commit et push uniquement les fichiers créés**, sans toucher aux autres modifications locales.

```bash
# Ajouter UNIQUEMENT le fichier newsletter créé
git add "Newsletter template/newsletter_YYYY-MM-DD.html"

# Commit avec un message descriptif
git commit -m "Newsletter DD-DD mois YYYY (événements spéciaux)"

# Push
git push
```

### ⚠️ Important :
- **NE PAS** faire `git add .` ou `git add -A` — cela ajouterait d'autres modifications locales non liées
- Ajouter uniquement le(s) fichier(s) newsletter créé(s) avec `git add` ciblé
- Le message de commit doit mentionner la plage de dates et les événements spéciaux (ex: `"Newsletter 19-25 oct 2026 (Cina Domnului)"`)
- Si le SKILL.md a été modifié, l'ajouter aussi au commit
