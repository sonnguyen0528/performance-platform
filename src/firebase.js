import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBh-YtTlh01-3rbv5ROFl23zPH2kcNpMCM",
  authDomain: "performance-platform-766bd.firebaseapp.com",
  projectId: "performance-platform-766bd",
  storageBucket: "performance-platform-766bd.firebasestorage.app",
  messagingSenderId: "816080210349",
  appId: "1:816080210349:web:5f98fcbc556a2f4ffd7924",
  measurementId: "G-C0N03Y0JYV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
