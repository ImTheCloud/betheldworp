import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyATfKWzTiu0K-bIgstl4cNaWi00X0MqGro",
    authDomain: "betheldworp.firebaseapp.com",
    projectId: "betheldworp",
    storageBucket: "betheldworp.firebasestorage.app",
    messagingSenderId: "783281883908",
    appId: "1:783281883908:web:d2d3be7da7286725b31e51",
    measurementId: "G-QQC8KW5G0W"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db;

// Le panneau d'administration n'utilise PAS le cache partagé entre onglets.
//
// persistentMultipleTabManager fait élire un onglet « meneur » qui détient seul
// la connexion réseau ; les autres onglets de la même origine passent par lui.
// Or les onglets du site public n'ont aucun utilisateur connecté. Quand l'un
// d'eux est le meneur, les lectures faites depuis l'admin partent sur une
// connexion sans jeton, et Firestore répond permission-denied alors que le
// compte est admin et le mot de passe correct. C'est ce qui refusait l'accès
// tant qu'une page du site restait ouverte dans un autre onglet, et pourquoi
// réessayer n'y changeait rien : réessayer ne change pas le meneur.
//
// L'admin n'a de toute façon rien à gagner à ce cache : il lit déjà ses
// documents avec getDocFromServer pour ne jamais afficher une réponse périmée.
const surAdmin =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

if (typeof document !== "undefined") {
    try {
        if (process.env.NODE_ENV === "development" || surAdmin) {
            db = getFirestore(app);
        } else {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
        }
    } catch {
        db = getFirestore(app);
    }
} else {
    db = getFirestore(app);
}

export { db };