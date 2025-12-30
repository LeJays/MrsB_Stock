import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCh2oxRNlaLUzfWNgyRpQg5fzBSbYEowdA",
    authDomain: "mrsbstock.firebaseapp.com",
    projectId: "mrsbstock",
    storageBucket: "mrsbstock.firebasestorage.app",
    messagingSenderId: "572591163450",
    appId: "1:572591163450:web:00c5ec1bedef87679b4d03"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ecouter les entrées en temps réel
onSnapshot(collection(db, "entrees"), (snap) => {
    let total = 0;
    const list = document.getElementById('listEntrees');
    list.innerHTML = "";
    snap.forEach(doc => {
        const data = doc.data();
        total += data.montant;
        list.innerHTML += `<tr>
            <td>${data.date}</td>
            <td>${data.heure || ''}</td>
            <td>${data.categorie}</td>
            <td>${data.quantite}</td>
            <td>${data.auteur}</td>
        </tr>`;
    });
    document.getElementById('totalEntrees').innerText = total.toLocaleString();
});

// Le même principe s'appliquera pour les Sorties...