import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { browserLocalPersistence, getAuth, setPersistence } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCeVhAobvObhafPvRb6-SD4NN8mNtL4rGw",
    authDomain: "johnybrowserhub.firebaseapp.com",
    databaseURL: "https://johnybrowserhub-default-rtdb.firebaseio.com",
    projectId: "johnybrowserhub",
    storageBucket: "johnybrowserhub.firebasestorage.app",
    messagingSenderId: "119679857218",
    appId: "1:119679857218:web:6704aeb6aab486087a33db",
    measurementId: "G-ZSZ04R06GE"
};

export const SCHOOL_ACCESS_SESSION_KEY = "johnybrowserhub-school-access-session";
export const SCHOOL_SETTINGS_COLLECTION = "schoolSettings";

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let persistencePromise = null;

export function ensureSchoolPersistence() {
    if (!persistencePromise) {
        persistencePromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
            console.warn("School auth persistence fallback:", error);
        });
    }

    return persistencePromise;
}

export function normalizeEmail(value) {
    return `${value || ""}`.trim().toLowerCase();
}

export function toSlug(value) {
    return `${value || ""}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "school";
}
