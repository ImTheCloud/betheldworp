# 🌐 Official website

👉 **https://www.betheldworp.be/**

---

# Bethel Dworp — Website (Next.js + Firebase)

Official website of **Bethel Dworp**, built with **Next.js (App Router)**, a modern UI, **dynamic content powered by Firebase (Firestore)**, **multi-language support** (RO/FR/NL/EN), and key sections such as the weekly program, events, gallery (images + YouTube videos), location, donations, and contact.

---

## ✨ Features

- **Multi-language**: RO / FR / NL / EN
  - `bethel_lang` cookie + `Accept-Language` detection on first load.
- **Dynamic hero**: monthly verse managed via Firebase (Firestore).
- **Weekly program**:
  - Local schedule (day / time / activity)
  - **Special announcements** managed via Firestore, highlighting affected days + “flip” card interaction.
  - Correct date handling for **Europe/Brussels**.
- **Events calendar**:
  - Events managed via Firestore displayed in a monthly calendar.
  - Event modal with image, date, time, place + Google Maps.
  - Auto-selects today’s event or the next upcoming event.
- **Newsletter**: subscriptions stored via Firestore.
- **Gallery**:
  - Images (modal)
  - YouTube videos (thumbnails + modal player)
  - Auto horizontal scrolling (pauses on hover/touch/focus)
- **Donations**: IBAN copy button + donation types as cards.
- **Contact**: floating widget + modal, sending via **EmailJS**, mobile optimizations (viewport/scroll).
- **Header**: smooth-scroll navigation, mobile menu, active section tracking via IntersectionObserver.
- **Footer**: contact details (responsible person + developer), dynamic copyright, multi-language.

---

## 🧱 Stack

- **Next.js** (App Router) + React (Client Components)
- **Firebase (Firestore)** for dynamic content
- **EmailJS** for the contact form
- JSON-based **i18n** via `makeT()` / `getLocale()`
- Google Maps embed (iframe)

---

## 🧑‍💻 Content workflow

- Monthly verse: update content via Firebase
- Events: add / edit events via Firebase
- Weekly announcements: publish announcements and target the relevant days
- Newsletter: automatically populated via the website

---

## 📄 License

**Exclusive property of Popadiuc Claudiu - Bethel Dworp. All rights reserved.**
This source code is provided for reference purposes only. No license is granted to use, copy, modify, or distribute this software in any form without the prior written permission of the author.


