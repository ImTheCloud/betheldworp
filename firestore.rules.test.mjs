import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, collectionGroup, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";

const env = await initializeTestEnvironment({
    projectId: "demo-bethel",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8117 },
});

let pass = 0, fail = 0;
async function check(label, shouldPass, fn) {
    try {
        await (shouldPass ? assertSucceeds(fn()) : assertFails(fn()));
        console.log(`  ok   ${label}`);
        pass++;
    } catch (e) {
        console.log(`  FAIL ${label}  ->  ${String(e.message).slice(0, 110)}`);
        fail++;
    }
}

// seed data + the admin roster, bypassing rules
await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "admins", "boss"), { role: "admin" });
    await setDoc(doc(d, "events", "e1"), { title: "x" });
    await setDoc(doc(d, "monthly_verse", "current"), { text: "x" });
    await setDoc(doc(d, "program_overrides", "2026-W40"), { weekKey: "2026-W40" });
    await setDoc(doc(d, "churches", "c1"), { name: "x", likes: 5 });
    await setDoc(doc(d, "newsletter", "bob@x.be"), { email: "bob@x.be", source: "website" });
    await setDoc(doc(d, "church_suggestions", "s1"), { status: "pending" });
    await setDoc(doc(d, "visits", "day_2026-09-01", "visitors", "seed"), { visitorId: "seed" });
    await setDoc(doc(d, "world_map_visits", "day_2026-09-01", "map_visitors", "seed"), { visitorId: "seed" });
});

const anon = env.unauthenticatedContext().firestore();
const admin = env.authenticatedContext("boss").firestore();
const other = env.authenticatedContext("random").firestore();

console.log("\n— Lecture publique du site —");
await check("anon lit events", true, () => getDocs(collection(anon, "events")));
await check("anon lit monthly_verse", true, () => getDoc(doc(anon, "monthly_verse", "current")));
await check("anon lit program_overrides", true, () => getDoc(doc(anon, "program_overrides", "2026-W40")));
await check("anon lit churches", true, () => getDocs(collection(anon, "churches")));

console.log("\n— Newsletter —");
await check("anon get une adresse precise", true, () => getDoc(doc(anon, "newsletter", "bob@x.be")));
await check("anon NE PEUT PAS lister les emails", false, () => getDocs(collection(anon, "newsletter")));
await check("anon s'abonne (3 champs, id = email)", true, () =>
    setDoc(doc(anon, "newsletter", "new@x.be"), { email: "new@x.be", subscribedAt: serverTimestamp(), source: "website" }));
await check("anon NE PEUT PAS s'abonner avec un champ en trop", false, () =>
    setDoc(doc(anon, "newsletter", "evil@x.be"), { email: "evil@x.be", subscribedAt: serverTimestamp(), source: "website", isAdmin: true }));
await check("anon NE PEUT PAS creer un doc dont l'id ne correspond pas", false, () =>
    setDoc(doc(anon, "newsletter", "aaa@x.be"), { email: "bbb@x.be", subscribedAt: serverTimestamp(), source: "website" }));
await check("anon se desabonne", true, () =>
    setDoc(doc(anon, "newsletter", "bob@x.be"), { unsubscribed: true, updatedAt: new Date() }, { merge: true }));
await check("anon se reabonne", true, () =>
    setDoc(doc(anon, "newsletter", "bob@x.be"), { unsubscribed: false, updatedAt: new Date() }, { merge: true }));
await check("anon NE PEUT PAS ecraser l'email d'un abonne", false, () =>
    updateDoc(doc(anon, "newsletter", "bob@x.be"), { email: "hacked@x.be" }));
await check("anon NE PEUT PAS supprimer un abonne", false, () => deleteDoc(doc(anon, "newsletter", "bob@x.be")));

console.log("\n— Suggestions d'eglises —");
const inUnAn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
const suggestion = (extra = {}) => ({
    type: "new", originalChurchId: null, status: "pending",
    data: { name: "x" }, createdAt: serverTimestamp(), expiresAt: inUnAn, ...extra,
});
await check("anon propose une eglise (pending)", true, () =>
    addDoc(collection(anon, "church_suggestions"), suggestion()));
await check("anon NE PEUT PAS deposer une suggestion deja approuvee", false, () =>
    addDoc(collection(anon, "church_suggestions"), suggestion({ status: "approved" })));
await check("anon NE PEUT PAS lire les suggestions", false, () =>
    getDocs(query(collection(anon, "church_suggestions"), where("status", "==", "pending"))));
// La date d'expiration porte l'effacement automatique : sans elle, les
// coordonnees du proposant resteraient indefiniment.
await check("anon NE PEUT PAS proposer sans date d'expiration", false, () =>
    addDoc(collection(anon, "church_suggestions"), { type: "new", originalChurchId: null, status: "pending", data: {}, createdAt: serverTimestamp() }));
await check("anon NE PEUT PAS mettre autre chose qu'une date en expiresAt", false, () =>
    addDoc(collection(anon, "church_suggestions"), suggestion({ expiresAt: "jamais" })));
await check("anon NE PEUT PAS inventer un type", false, () =>
    addDoc(collection(anon, "church_suggestions"), suggestion({ type: "pirate" })));
await check("anon NE PEUT PAS deverser 21 champs dans data", false, () =>
    addDoc(collection(anon, "church_suggestions"),
        suggestion({ data: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "x"])) })));
await check("anon propose avec 20 champs dans data (limite haute)", true, () =>
    addDoc(collection(anon, "church_suggestions"),
        suggestion({ data: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "x"])) })));
// La charge exacte que ChurchMap.jsx envoie : 13 champs du formulaire plus le
// bloc submitter. Une regle qui passe les tests synthetiques mais refuse la
// vraie forme casserait le formulaire sans que rien ne le signale.
await check("anon propose avec la charge reelle du formulaire", true, () =>
    addDoc(collection(anon, "church_suggestions"), suggestion({
        data: {
            name: "Biserica X", city: "Bruxelles", zipCode: "1000", street: "Rue", number: "1",
            phone: "+32", email: "a@b.be", website: "", youtube: "", facebook: "", instagram: "",
            country: "Belgium", locationTitle: "",
            submitter: { firstName: "A", lastName: "B", phone: "+32", email: "a@b.be", notes: "" },
        },
    })));

console.log("\n— Likes publics —");
await check("anon +1 like", true, () => updateDoc(doc(anon, "churches", "c1"), { likes: 6 }));
await check("anon NE PEUT PAS mettre likes a 999999", false, () => updateDoc(doc(anon, "churches", "c1"), { likes: 999999 }));
await check("anon NE PEUT PAS renommer une eglise", false, () => updateDoc(doc(anon, "churches", "c1"), { name: "pirate" }));

console.log("\n— Tracking —");
// Charges reprises telles quelles de VisitTracker.jsx et Tracker.js, avec les
// formes relevees sur les documents reels en production. Une regle qui passe des
// tests synthetiques mais refuse la vraie forme arreterait le comptage sans que
// rien ne le signale.
const expire = new Date(Date.now() + 760 * 24 * 60 * 60 * 1000);
const visiteur = (id, extra = {}) => ({
    visitorId: id, day: "01-09-2026", timeHM: "14:32", deviceType: "mobile",
    language: "ro", country: "Belgium", city: "Brussels", expiresAt: expire, ...extra,
});
const visiteurGlobal = (id, extra = {}) => ({
    visitorId: id, firstDay: "01-09-2026", firstTimeHM: "14:32", deviceType: "mobile",
    language: "ro", country: "Belgium", city: "Brussels", expiresAt: expire, ...extra,
});
const visiteurCarte = (id, extra = {}) => ({
    ...visiteur(id), geoStatus: "initial", timestamp: Date.now(), ...extra,
});
const jour = (id) => doc(anon, "visits", "day_01-09-2026", "visitors", id);
const jourAdmin = (id) => doc(admin, "visits", "day_01-09-2026", "visitors", id);
const carte = (id) => doc(anon, "world_map_visits", "day_01-09-2026", "map_visitors", id);

await check("anon cree un visiteur du jour (charge reelle)", true, () => setDoc(jour("v1"), visiteur("v1")));
await check("anon cree un visiteur global (charge reelle)", true, () => setDoc(doc(anon, "visits_global", "g1"), visiteurGlobal("g1")));
await check("anon cree un visiteur carte (charge reelle)", true, () => setDoc(carte("m1"), visiteurCarte("m1"), { merge: true }));
await check("anon cree un visiteur carte avec coordonnees precises", true, () =>
    setDoc(carte("m2"), visiteurCarte("m2", { preciseLat: 50.77, preciseLng: 4.30 }), { merge: true }));
await check("anon met a jour son visiteur carte (merge, comme le site)", true, () =>
    setDoc(carte("m1"), visiteurCarte("m1", { geoStatus: "granted" }), { merge: true }));

await check("anon NE PEUT PAS ajouter un champ inconnu", false, () =>
    setDoc(jour("v2"), visiteur("v2", { note: "charge utile" })));
await check("anon NE PEUT PAS ecrire sous l'identifiant d'un autre", false, () =>
    setDoc(jour("v3"), visiteur("quelquun-dautre")));
await check("anon NE PEUT PAS omettre la date d'expiration", false, () => {
    const d = visiteur("v4"); delete d.expiresAt; return setDoc(jour("v4"), d);
});
await check("anon NE PEUT PAS inventer un type d'appareil", false, () =>
    setDoc(jour("v5"), visiteur("v5", { deviceType: "frigo" })));
await check("anon NE PEUT PAS deverser un texte enorme dans city", false, () =>
    setDoc(jour("v6"), visiteur("v6", { city: "x".repeat(5000) })));
await check("anon NE PEUT PAS mettre un identifiant de 500 caracteres", false, () => {
    const id = "z".repeat(500); return setDoc(jour(id), visiteur(id));
});
await check("anon NE PEUT PAS inventer un geoStatus", false, () =>
    setDoc(carte("m3"), visiteurCarte("m3", { geoStatus: "pirate" }), { merge: true }));
await check("anon NE PEUT PAS poser une latitude hors bornes", false, () =>
    setDoc(carte("m4"), visiteurCarte("m4", { preciseLat: 9999, preciseLng: 4.30 }), { merge: true }));
await check("anon NE PEUT PAS ecrire dans bot_visits (collection retiree)", false, () =>
    setDoc(doc(anon, "bot_visits", "b1"), { visitorId: "b1" }));
await check("anon NE PEUT PAS lire les stats", false, () => getDocs(collectionGroup(anon, "visitors")));

// Purge RGPD manuelle : l'admin doit pouvoir supprimer, personne d'autre.
await check("admin supprime un visiteur du jour", true, () => deleteDoc(jourAdmin("v1")));
await check("admin supprime un visiteur global", true, () => deleteDoc(doc(admin, "visits_global", "g1")));
await check("admin supprime un visiteur carte", true, () =>
    deleteDoc(doc(admin, "world_map_visits", "day_01-09-2026", "map_visitors", "m1")));
await check("anon NE PEUT PAS supprimer un visiteur du jour", false, () =>
    deleteDoc(doc(anon, "visits", "day_01-09-2026", "visitors", "m2")));
await check("anon NE PEUT PAS supprimer un visiteur global", false, () =>
    deleteDoc(doc(anon, "visits_global", "g1")));
await check("anon NE PEUT PAS supprimer un visiteur carte", false, () =>
    deleteDoc(doc(anon, "world_map_visits", "day_01-09-2026", "map_visitors", "m2")));
await check("non-admin connecte NE PEUT PAS supprimer un visiteur", false, () =>
    deleteDoc(doc(other, "visits", "day_01-09-2026", "visitors", "m2")));

console.log("\n— Admin —");
await check("admin lit la liste newsletter", true, () => getDocs(collection(admin, "newsletter")));
await check("admin lit les suggestions", true, () =>
    getDocs(query(collection(admin, "church_suggestions"), where("status", "==", "pending"))));
await check("admin lit les brouillons d'eglises", true, () =>
    getDocs(query(collection(admin, "churches"), where("isDraft", "==", true))));
await check("admin ecrit un evenement", true, () => setDoc(doc(admin, "events", "e2"), { title: "y" }));
await check("admin supprime un evenement", true, () => deleteDoc(doc(admin, "events", "e2")));
await check("admin ecrit un override", true, () => setDoc(doc(admin, "program_overrides", "2026-W41"), { weekKey: "2026-W41" }));
await check("admin ecrit le verset", true, () => setDoc(doc(admin, "monthly_verse", "current"), { text: "y" }));
await check("admin ecrit une eglise", true, () => setDoc(doc(admin, "churches", "c2"), { name: "y" }));
await check("admin traite une suggestion", true, () => updateDoc(doc(admin, "church_suggestions", "s1"), { status: "approved" }));
await check("admin supprime un abonne", true, () => deleteDoc(doc(admin, "newsletter", "new@x.be")));
await check("admin requete collectionGroup visitors", true, () => getDocs(collectionGroup(admin, "visitors")));
await check("admin requete collectionGroup map_visitors", true, () => getDocs(collectionGroup(admin, "map_visitors")));
await check("admin lit visits_global", true, () => getDocs(collection(admin, "visits_global")));
await check("admin lit son propre doc admins", true, () => getDoc(doc(admin, "admins", "boss")));

console.log("\n— Escalade de privileges —");
await check("admin NE PEUT PAS se nommer un co-admin", false, () => setDoc(doc(admin, "admins", "complice"), { role: "admin" }));
await check("admin NE PEUT PAS se retirer / retirer un autre admin", false, () => deleteDoc(doc(admin, "admins", "boss")));
await check("non-admin NE PEUT PAS se promouvoir", false, () => setDoc(doc(other, "admins", "random"), { role: "admin" }));
await check("non-admin NE PEUT PAS lire le doc d'un autre", false, () => getDoc(doc(other, "admins", "boss")));
await check("non-admin NE PEUT PAS ecrire un evenement", false, () => setDoc(doc(other, "events", "e9"), { title: "z" }));

console.log(`\n=== ${pass} reussis, ${fail} echoues ===`);
await env.cleanup();
process.exit(fail === 0 ? 0 : 1);
