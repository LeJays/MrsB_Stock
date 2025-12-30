import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCh2oxRNlaLUzfWNgyRpQg5fzBSbYEowdA",
  authDomain: "mrsbstock.firebaseapp.com",
  projectId: "mrsbstock",
  storageBucket: "mrsbstock.firebasestorage.app",
  messagingSenderId: "572591163450",
  appId: "1:572591163450:web:00c5ec1bedef87679b4d03"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);