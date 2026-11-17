# Passage de Combell à Infomaniak : nom de domaine et adresse mail

État relevé le 17 novembre 2026. À relire avant de commencer : chaque valeur ci-dessous a été vérifiée ce jour-là (DNS interrogé directement sur les serveurs de Combell, compte Brevo, projet Vercel).

**Échéance : le nom de domaine `betheldworp.be` expire le 17 décembre 2026 chez Combell.** Le transfert vers Infomaniak doit être fini avant. Un domaine expiré part en quarantaine et sa récupération coûte cher (environ 100 €). Viser un lancement du transfert fin novembre.

Le but : garder `betheldworp.be` et `info@betheldworp.be` à l'identique, sans coupure du site ni perte de mails, et finir mieux qu'avant (signature DKIM sur la boîte mail, DMARC plus strict).

---

## 1. Ce qui dépend du domaine

| Service | Rôle | Lien avec Combell | Ce qu'il faut faire |
|---|---|---|---|
| **Site web** (Vercel, projet `betheldworp`) | www.betheldworp.be et betheldworp.be | Seulement les enregistrements DNS `@` et `www` | Recopier les 2 enregistrements à l'identique. Rien à changer chez Vercel. |
| **Boîte mail** `info@betheldworp.be` | Réception et envoi des mails de l'église | Hébergée chez Combell (« Hébergement d'e-mail Basic », serveurs `mailprotect.be`) | La recréer chez Infomaniak, importer les anciens mails, puis basculer les MX. |
| **Newsletter** (Brevo, plan gratuit) | Envoi hebdomadaire depuis l'admin du site | Domaine authentifié chez Brevo par 2 CNAME DKIM + 1 TXT `brevo-code` | Recopier ces 3 enregistrements à l'identique. Brevo ne voit aucune différence. |
| **Formulaire de contact** (EmailJS) | Envoi des messages du site | **À vérifier** : si le « service » EmailJS envoie avec le compte info@ de Combell (SMTP `mailprotect.be`), il cassera | Ouvrir le tableau de bord EmailJS, onglet Email Services. Si c'est un SMTP Combell, le remplacer par le SMTP Infomaniak avec le nouveau mot de passe. |
| Firebase (Auth, Firestore) | Admin et données du site | Aucun | Rien. |
| ntfy (notifications téléphone) | Alertes abonnés, newsletter du dimanche | Aucun | Rien. |
| Webhook Brevo → `https://www.betheldworp.be/api/brevo/webhook` | Désinscriptions | Passe par `www` (Vercel) | Rien, tant que `www` pointe vers Vercel. |

---

## 2. Zone DNS actuelle chez Combell (relevée le 17/11/2026)

Serveurs de noms actuels : `ns1.combell.eu`, `ns3.combell.net`, `ns4.combell.net`.

| Nom | Type | Valeur | Rôle | Chez Infomaniak |
|---|---|---|---|---|
| `@` | A | `216.198.79.1` | Site (Vercel) | **Recopier tel quel** |
| `www` | CNAME | `b6baa5de772ed60a.vercel-dns-017.com` | Site (Vercel) | **Recopier tel quel** |
| `brevo1._domainkey` | CNAME | `b1.betheldworp-be.dkim.brevo.com` | Signature DKIM de la newsletter | **Recopier tel quel** |
| `brevo2._domainkey` | CNAME | `b2.betheldworp-be.dkim.brevo.com` | Signature DKIM de la newsletter | **Recopier tel quel** |
| `@` | TXT | `brevo-code:135f75a5f17e723f1df4844eef35de43` | Preuve de propriété pour Brevo | **Recopier tel quel** |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | Politique DMARC | **Recopier tel quel** (durcir plus tard, voir §5) |
| `@` | TXT | `v=spf1 mx include:_spf.relay.mailprotect.be ~all` | SPF (serveurs autorisés à envoyer) | **Remplacer** par la version Infomaniak (§3) |
| `@` | MX | `10 mx.mailprotect.be`, `50 mx.backup.mailprotect.be` | Réception des mails | **Remplacer** par le MX Infomaniak (§3) |
| `mail` | CNAME | `pop3.mailprotect.be` | Ancien raccourci Combell | Ne pas recopier |
| `autoconfig`, `autodiscover` | CNAME | `*.mailprotect.be` | Configuration auto des clients mail Combell | Ne pas recopier (Infomaniak a les siens, à ajouter seulement s'il les propose) |
| `_autodiscover._tcp`, `_imaps._tcp`, `_pop3s._tcp`, `_submission._tcp` | SRV | `*.mailprotect.be` | Idem, Combell | Ne pas recopier |
| `ftp` | A | `217.21.190.139` | Ancien hébergement FTP Combell | Ne pas recopier (inutilisé : le site est sur Vercel) |

Pas d'enregistrement CAA, pas de vérification Google dans le DNS.

---

## 3. Zone cible chez Infomaniak

| Nom | Type | Valeur |
|---|---|---|
| `@` | A | `216.198.79.1` |
| `www` | CNAME | `b6baa5de772ed60a.vercel-dns-017.com` |
| `@` | MX | `5 mta-gw.infomaniak.ch` (un seul MX, c'est la consigne d'Infomaniak) |
| `@` | TXT | `v=spf1 include:spf.infomaniak.ch ~all` |
| DKIM Infomaniak | TXT ou CNAME | Valeur donnée par le Manager Infomaniak une fois le Service Mail créé (à activer) |
| `brevo1._domainkey` | CNAME | `b1.betheldworp-be.dkim.brevo.com` |
| `brevo2._domainkey` | CNAME | `b2.betheldworp-be.dkim.brevo.com` |
| `@` | TXT | `brevo-code:135f75a5f17e723f1df4844eef35de43` |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

Notes :
- **Un seul enregistrement SPF.** Infomaniak en crée un automatiquement (`-all`) à la création du Service Mail. Garder un seul TXT SPF, sinon les deux sont ignorés. `~all` est plus prudent les premières semaines.
- **Brevo n'a pas besoin d'être dans le SPF** : il envoie avec sa propre adresse de retour, et la newsletter passe DMARC grâce à sa signature DKIM sur `betheldworp.be` (les deux CNAME `brevo1`/`brevo2`).
- **Vercel** : la valeur `www` est propre au projet. Si Vercel en affiche une autre dans Settings → Domains au moment de la migration, c'est celle de Vercel qui fait foi.

---

## 4. Déroulé conseillé, dans l'ordre

**Avant de commencer (une seule fois)**
1. Créer le compte Infomaniak.
2. Chez Combell : vérifier qu'aucune protection contre le transfert n'est active sur le domaine.
3. Vérifier quelle adresse mail est enregistrée comme titulaire du domaine. Le code de transfert d'un `.be` (code DNS Belgium) est envoyé **uniquement à cette adresse**. Elle doit être lisible au moment du transfert. Si c'est `info@betheldworp.be`, ça marche : la boîte Combell fonctionne jusqu'au bout.

**Boîte mail (sans rien couper)**
4. Chez Infomaniak, créer le Service Mail pour `betheldworp.be` et la boîte `info@betheldworp.be` (nouveau mot de passe).
5. Importer les anciens mails avec l'outil d'import d'Infomaniak (IMAP). Source Combell : serveur `imap.mailprotect.be`, port 993, SSL, identifiant `info@betheldworp.be` et mot de passe Combell. Infomaniak propose aussi une migration gratuite faite par leur équipe.

**Domaine**
6. Chez Infomaniak, commander le transfert de `betheldworp.be` (inclut un an de renouvellement) et demander le code via le bouton prévu (« Get authorization code ») ou sur dnsbelgium.be. **Ne pas réessayer plusieurs fois avec un code faux** : le domaine se bloque plusieurs dizaines d'heures.
7. Dès que la zone DNS est gérée par Infomaniak : saisir **toute la zone du §3** et vérifier chaque ligne avant que les serveurs de noms basculent.
8. Activer le DKIM de la boîte mail dans le Manager Infomaniak (c'est ce que Combell ne permettait pas sur la formule Basic).

**Vérifications (le jour même)**
9. Lancer depuis un terminal les commandes du §7. Chaque ligne doit afficher les valeurs du §3.
10. Ouvrir https://www.betheldworp.be et https://betheldworp.be.
11. S'envoyer un mail depuis Gmail vers info@ (réception), et depuis info@ vers Gmail (envoi). Dans Gmail, « Afficher l'original » : SPF, DKIM et DMARC doivent être à PASS.
12. Envoyer un mail de info@ vers l'adresse donnée par https://www.mail-tester.com : viser 10/10.
13. Dans Brevo, Paramètres → Expéditeurs, domaines → `betheldworp.be` doit rester « authentifié ». Faire un « Trimite test » depuis l'admin du site.
14. Envoyer un message avec le formulaire de contact du site (EmailJS).

**Appareils**
15. Reconfigurer la boîte info@ sur le téléphone et sur Outlook avec les réglages Infomaniak : IMAP `mail.infomaniak.com` port 993 SSL, SMTP `mail.infomaniak.com` port 465 SSL, identifiant complet `info@betheldworp.be`. À confirmer dans l'aide Infomaniak au moment de le faire.

**Fermer Combell (une à deux semaines plus tard, quand tout marche)**
16. Vérifier que plus aucun mail n'arrive dans le webmail Combell.
17. Résilier l'hébergement mail Combell et désactiver tout renouvellement restant. Le domaine, lui, est déjà parti chez Infomaniak.

---

## 5. Faire mieux qu'avec Combell

- **DKIM sur info@** : activé chez Infomaniak à l'étape 8. Ce n'était pas possible sur Combell Basic.
- **DMARC plus strict** : après 3 à 4 semaines, si les rapports DMARC reçus par Brevo ne montrent que des envois légitimes à PASS, passer `_dmarc` à
  `v=DMARC1; p=quarantine; rua=mailto:rua@dmarc.brevo.com`.
  Plus tard encore : `p=reject`. Cela empêche quiconque d'envoyer des faux mails « de » betheldworp.be.
- **SPF strict** : une fois tous les envois vérifiés, `~all` peut passer à `-all`.

---

## 6. Ce qui ne doit pas bouger

- Les 3 enregistrements Brevo (`brevo1`, `brevo2`, `brevo-code`) : sans eux, la newsletter perd son authentification et finit en spam.
- Le A `@` et le CNAME `www` de Vercel : sans eux, le site tombe.
- Brevo : la restriction d'adresses IP des clés API doit rester **désactivée** (les serveurs Vercel changent d'adresse).
- L'expéditeur Brevo reste `Bethel Dworp <info@betheldworp.be>` : l'adresse ne change pas, seul l'hébergeur de la boîte change.

---

## 7. Commandes de vérification

```bash
dig +short betheldworp.be A
dig +short www.betheldworp.be CNAME
dig +short betheldworp.be MX
dig +short betheldworp.be TXT
dig +short _dmarc.betheldworp.be TXT
dig +short brevo1._domainkey.betheldworp.be CNAME
dig +short brevo2._domainkey.betheldworp.be CNAME
dig +short betheldworp.be NS
```

Attendu après migration : NS chez Infomaniak, MX `mta-gw.infomaniak.ch`, un seul SPF avec `include:spf.infomaniak.ch`, le reste identique au §2.

---

## 8. Pour l'assistant IA qui reprendra ce dossier

- Le projet : site Next.js 16 (App Router) sur Vercel, Firebase Auth + Firestore sans compte de service (le serveur lit Firestore en REST, avec le jeton de l'admin quand il le faut : `app/lib/adminAuth.js`, `app/lib/firestoreRest.js`).
- Brevo : liste newsletter **#7** « Newsletter Bethel Dworp », expéditeur n° 2 `Bethel Dworp <info@betheldworp.be>`, webhook n° 2161278 (événements `unsubscribed`, `spam`, `contactDeleted`) vers `/api/brevo/webhook?token=…`. Plan gratuit : 300 mails par jour, **pas d'étiquette (tag) sur les campagnes**.
- Newsletter hebdomadaire : code dans `app/lib/newsletter/`, routes `app/api/newsletter/weekly/*`, écran admin `/admin#weekly`, tâche Vercel `/api/cron/newsletter` le dimanche à 17:00 UTC (variable `CRON_SECRET` en production). Chaque envoi crée une liste Brevo `Newsletter <semaine> #n` dans le dossier « Newsletter trimis » : ne pas les supprimer pendant la semaine, elles empêchent les doubles envois.
- Variables d'environnement concernées (noms seulement) : `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_WEBHOOK_TOKEN`, `NTFY_TOPIC`, `CRON_SECRET`, `NEXT_PUBLIC_EMAILJS_*`. Aucune ne contient le nom de l'hébergeur mail : la migration ne demande **aucun changement de code**.
- Règles de l'utilisateur à respecter : ne jamais envoyer la newsletter à sa place, ne jamais envoyer deux fois la même semaine aux mêmes personnes, newsletter en roumain uniquement, salutation « Pacea Domnului, dragi frați și surori, ».
- Pendant la migration : comparer la zone saisie chez Infomaniak avec le §3 ligne par ligne, puis vérifier avec les commandes du §7, avant de dire que c'est fini.
