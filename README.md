
# 🌐 Site officiel

👉 **https://www.betheldworp.be/**

---

# Bethel Dworp — Site web (Next.js + Firebase)

Site web officiel de **Bethel Dworp**, construit avec **Next.js (App Router)**, une UI moderne, du **contenu dynamique via Firebase Firestore**, un **support multilingue** (RO/FR/NL/EN) et des sections clés : programme hebdomadaire, événements, galerie (images + vidéos YouTube), localisation, dons, contact, etc.

---

## ✨ Fonctionnalités

- **Multilingue** : RO / FR / NL / EN
  - Cookie `bethel_lang` + détection `Accept-Language` au premier chargement.
- **Hero dynamique** : verset du mois depuis Firestore (`monthly_verse/current`).
- **Programme hebdomadaire** :
  - Liste locale (jours / horaires / activité)
  - **Annonces spéciales** Firestore (`program_announcements`) avec mise en évidence des jours impactés + carte “flip”.
  - Gestion correcte du jour en **Europe/Brussels**.
- **Calendrier d’événements** :
  - Événements Firestore (`events`) affichés dans un calendrier mensuel.
  - Modal événement avec image, date, heure, lieu + Google Maps.
  - Auto-sélection de l’événement du jour ou du prochain événement.
- **Newsletter** : inscription enregistrée dans Firestore (`newsletter`).
- **Galerie** :
  - Images (modal)
  - Vidéos YouTube (thumbnails + modal player)
  - Scroll horizontal auto (pause au hover/touch/focus)
- **Dons** : IBAN + bouton “copier” + types de dons en cartes.
- **Contact** : widget flottant + modal, envoi via **EmailJS**, optimisations mobile (viewport/scroll).
- **Header** : navigation smooth scroll, menu mobile, section active via IntersectionObserver.

---

## 🧱 Stack

- **Next.js** (App Router) + React (Client Components)
- **Firebase Firestore** (contenu dynamique + newsletter + annonces + événements)
- **EmailJS** (formulaire de contact)
- **i18n** via JSON + `makeT()` / `getLocale()`
- Google Maps embed (iframe)

---

## 📁 Structure (logique)

- `app/`
  - `layout.js` (RootLayout, preload image, LanguageProvider, VisitTracker)
  - `page.js` (Home : sections + Footer + ContactWidget)
- `components/`
  - `Header.js`, `LanguageProvider.js`, `ContactWidget.js`, `Footer.js`, `VisitTracker.js`
- `sections/`
  - `Hero.js`, `About.js`, `WeeklyProgram.js`, `EventsCalendar.js`, `Gallery.js`, `Donations.js`, `Location.js`
- `lib/`
  - `Firebase.js`, `i18n.js`
- `translations/` (JSON par section)
- `public/`
  - `images/` + `icon.png`

---

## 🚀 Démarrage en local

### 1) Installer

```bash
npm install
```

### 2) Variables d’environnement

Créer un fichier `.env.local` à la racine :

```bash
# EmailJS (ContactWidget)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=...
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=...
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=...

# Firebase (selon lib/Firebase.js)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> ⚠️ Les noms exacts des variables Firebase dépendent de `lib/Firebase.js`.

### 3) Lancer

```bash
npm run dev
```

Ouvrir : `http://localhost:3000`

---

## 🔥 Modèle Firestore

### `monthly_verse/current`

```json
{
  "reference": { "ro": "…", "fr": "…", "nl": "…", "en": "…" },
  "text": { "ro": "…", "fr": "…", "nl": "…", "en": "…" }
}
```

### `program_announcements/*`

```json
{
  "until": "2025-12-31",
  "message": { "ro": "…", "fr": "…", "nl": "…", "en": "…" },
  "affectedProgramIds": ["mon", "tue", "sun_am"]
}
```

IDs attendus côté programme : `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun_am`, `sun_pm`.

### `events/*`

```json
{
  "dateEvent": "2025-12-31",
  "time": "18:00",
  "title": { "ro": "…", "fr": "…", "nl": "…", "en": "…" },
  "description": { "ro": "…", "fr": "…", "nl": "…", "en": "…" },
  "place": "Bethel Dworp",
  "address": "…",
  "image": "https://…"
}
```

### `newsletter/{email}`

Créé via `setDoc(doc(db, "newsletter", normalizedEmail))` :

```json
{
  "email": "test@example.com",
  "createdAt": "serverTimestamp"
}
```

---

## 🔒 Notes Firestore (important)

Le site écrit dans `newsletter`. Assure-toi que tes règles Firestore autorisent au minimum la création des documents nécessaires (ou passe par une API/Function si tu veux un contrôle plus strict).

---

## 🧑‍💻 Contenu (workflow)

- Verset du mois : modifier `monthly_verse/current`
- Événements : ajouter/modifier des docs dans `events`
- Annonces programme : ajouter des docs dans `program_announcements` avec `until` + `affectedProgramIds`
- Newsletter : alimentée automatiquement via le site

---

## 📄 Licence

À définir (souvent **Private / All rights reserved** pour un site officiel).
