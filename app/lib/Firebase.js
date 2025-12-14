import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyATfKWzTiu0K-bIgstl4cNaWi00X0MqGro",
    authDomain: "betheldworp.firebaseapp.com",
    projectId: "betheldworp",
    storageBucket: "betheldworp.firebasestorage.app",
    messagingSenderId: "783281883908",
    appId: "1:783281883908:web:d2d3be7da7286725b31e51",
    measurementId: "G-QQC8KW5G0W"
};


const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);