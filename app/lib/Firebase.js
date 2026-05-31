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

if (typeof document !== "undefined") {
    try {
        if (process.env.NODE_ENV === "development") {
            db = getFirestore(app);
        } else {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
        }
    } catch (e) {
        db = getFirestore(app);
    }
} else {
    db = getFirestore(app);
}

export { db };