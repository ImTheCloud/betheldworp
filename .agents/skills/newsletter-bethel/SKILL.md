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
- **Dimanche soir ANULAT** (chip rouge `chip-c`) avec note "(datorită zilei de post)"
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

## 4. Styles visuels des chips (badges jour)

Il y a 3 types de chips dans le calendrier :

| Type | Classe CSS | Couleur | Utilisation |
|------|-----------|---------|-------------|
| **Normal** | `chip-n` / `chip-n-lbl` / `chip-n-num` | Gris sur fond `#f1f5f9` | Programme standard |
| **Spécial** | `chip-s` / `chip-s-lbl` / `chip-s-num` | Vert `#16a34a` sur fond `#dcfce7`, bordure `#86efac` | Événement spécial (Cina Domnului, invité, etc.) |
| **Annulé** | `chip-c` / `chip-c-lbl` / `chip-c-num` | Rouge `#dc2626` sur fond `#fee2e2`, bordure `#fca5a5` | Programme annulé |

Pour un événement **annulé**, utiliser la classe `t-cancel` pour le texte :
```html
<div class="t-cancel" style="font-size:15px;color:#dc2626;font-weight:700;line-height:1.45;">
    Program cu copiii (<span class="no-detect">11&zwnj;:00</span>) : ANULAT
</div>
```

---

## 5. Structure du fichier HTML

Le fichier newsletter suit TOUJOURS cette structure :

1. **`<head>`** — CSS identique à chaque fois (light/dark mode, responsive, Outlook fixes)
2. **Preheader** — Texte caché résumant les événements de la semaine
3. **Section 1 : En-tête** — Logo Bethel Dworp + lien site
4. **Section 2 : Bandeau date** — Fond vert `#16a34a` avec la plage de dates
5. **Section 3 : Image principale** — Image représentative (drone par défaut, ou supper.jpg pour Cina Domnului)
6. **Section 4 : Introduction** — Salutation + résumé des événements spéciaux
7. **Section 5 : Calendrier** — Tableau avec tous les jours de la semaine
8. **Section 6 : Sections détaillées** — Une section par événement spécial (6a, 6b, etc.)
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

### Méthode recommandée :

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

- [ ] Les **dates** sont correctes partout (title, bandeau, calendrier, sections)
- [ ] Les **numéros de jour** correspondent au bon jour de la semaine
- [ ] Les **événements spéciaux** sont bien marqués en vert (`chip-s`)
- [ ] Les **programmes annulés** sont bien en rouge (`chip-c`) avec mention "ANULAT"
- [ ] L'**image principale** correspond à l'événement phare
- [ ] Le **preheader** résume bien la semaine
- [ ] Le **verset biblique** est pertinent pour l'événement
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
