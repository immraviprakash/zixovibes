import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBi4jXmU6Az24oE5kw8m9kArmNUmxHs6P0",
    authDomain: "zixovibes.firebaseapp.com",
    projectId: "zixovibes",
    storageBucket: "zixovibes.firebasestorage.app",
    messagingSenderId: "380922480857",
    appId: "1:380922480857:web:ac4ae698f4eee5545f16c8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;