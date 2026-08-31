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

console.log("\n— Likes publics —");
await check("anon +1 like", true, () => updateDoc(doc(anon, "churches", "c1"), { likes: 6 }));
await check("anon NE PEUT PAS mettre likes a 999999", false, () => updateDoc(doc(anon, "churches", "c1"), { likes: 999999 }));
await check("anon NE PEUT PAS renommer une eglise", false, () => updateDoc(doc(anon, "churches", "c1"), { name: "pirate" }));

console.log("\n— Tracking —");
await check("anon cree un visiteur du jour", true, () =>
    setDoc(doc(anon, "visits", "day_2026-09-01", "visitors", "v1"), { visitorId: "v1", day: "2026-09-01" }));
await check("anon cree un visiteur global", true, () => setDoc(doc(anon, "visits_global", "v1"), { visitorId: "v1" }));
await check("anon cree un visiteur carte", true, () =>
    setDoc(doc(anon, "world_map_visits", "day_2026-09-01", "map_visitors", "v1"), { visitorId: "v1" }, { merge: true }));
await check("anon NE PEUT PAS lire les stats", false, () => getDocs(collectionGroup(anon, "visitors")));

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
