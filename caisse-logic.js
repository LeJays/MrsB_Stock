import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
    serverTimestamp, where, getDoc, doc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);

let currentUserId = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        // Récupérer le nom
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if(userDoc.exists()) {
            document.getElementById('vendeurNom').innerText = userDoc.data().nom;
        }
        chargerCategories();
        chargerMesVentes();
    } else {
        window.location.href = "index.html";
    }
});

function chargerCategories() {
    onSnapshot(collection(db, "categories"), (snap) => {
        const select = document.getElementById('sortieCat');
        if(!select) return;
        select.innerHTML = '<option value="">Choisir Catégorie...</option>';
        snap.forEach(doc => {
            select.innerHTML += `<option value="${doc.data().nom}">${doc.data().nom}</option>`;
        });
    });
}

document.getElementById('formSortie').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('sortieCat').value;
    const qteDemandee = parseInt(document.getElementById('sortieQty').value);

    // 1. VERIFICATION DU STOCK
    const eSnap = await getDocs(query(collection(db, "entrees"), where("categorie", "==", cat)));
    const sSnap = await getDocs(query(collection(db, "sorties"), where("categorie", "==", cat)));
    
    let tE = 0; let tS = 0;
    eSnap.forEach(d => tE += Number(d.data().quantite || 0));
    sSnap.forEach(d => tS += Number(d.data().quantite || 0));
    
    const dispo = tE - tS;

    if (qteDemandee > dispo) {
        alert("❌ STOCK INSUFFISANT ! Reste : " + dispo);
        return;
    }

    // 2. ENREGISTREMENT
    try {
        await addDoc(collection(db, "sorties"), {
            client: document.getElementById('sortieClient').value,
            vendeurNom: document.getElementById('vendeurNom').innerText,
            categorie: cat,
            produitNom: document.getElementById('sortieProduitNom').value,
            quantite: qteDemandee,
            montant: parseFloat(document.getElementById('sortiePrix').value),
            paiement: document.getElementById('sortiePaiement').value,
            vendeurId: currentUserId,
            date: new Date().toLocaleDateString('fr-FR'),
            heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: serverTimestamp()
        });
        alert("✅ Vente validée !");
        e.target.reset();
    } catch (err) { alert("Erreur: " + err.message); }
});

function chargerMesVentes() {
    // Requête simplifiée pour éviter les erreurs d'index Firebase au début
    const q = query(collection(db, "sorties"), where("vendeurId", "==", currentUserId));

    onSnapshot(q, (snap) => {
        const table = document.getElementById('listSortiesTable');
        if(!table) return;
        table.innerHTML = "";

        if(snap.empty) {
            table.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Aucune vente aujourd'hui</td></tr>";
            return;
        }

        // Tri manuel par date (plus récent en haut) pour éviter l'erreur d'index
        const sortedDocs = snap.docs.sort((a, b) => {
            const timeA = a.data().timestamp?.seconds || 0;
            const timeB = b.data().timestamp?.seconds || 0;
            return timeB - timeA;
        });

        sortedDocs.forEach(doc => {
            const d = doc.data();
            table.innerHTML += `
                <tr>
                    <td>${d.date} à ${d.heure || ''}</td>
                    <td>${d.client}</td>
                    <td>${d.categorie} - ${d.produitNom}</td>
                    <td>x${d.quantite}</td>
                    <td style="font-weight:bold">${(d.montant || 0).toLocaleString()}</td>
                    <td><span class="gold-badge">${d.paiement}</span></td>
                    <td><button class="btn-gold-outline" onclick="imprimerRecu('${doc.id}')">REÇU</button></td>
                </tr>`;
        });
    });
}

// Fenêtre de reçu
window.imprimerRecu = function(id) {
    const btn = event.target;
    const td = btn.closest('tr').querySelectorAll('td');

    // On crée une fenêtre de prévisualisation
    const win = window.open('', '_blank', 'width=500,height=700');
    
    win.document.write(`
        <html>
        <head>
            <title>Prévisualisation du Reçu - MRS.B</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    background: #f0f0f0; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    padding: 20px; 
                }
                /* Le ticket */
                .ticket { 
                    background: white; 
                    width: 350px; 
                    padding: 25px; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.2); 
                    text-align: center; 
                    color: #333; 
                }
                .brand { font-size: 22px; font-weight: bold; color: #D4AF37; margin-bottom: 0; }
                .slogan { font-size: 10px; letter-spacing: 1px; margin-bottom: 15px; }
                .hr { border-top: 1px dashed #000; margin: 15px 0; }
                .details { text-align: left; font-size: 14px; line-height: 1.8; }
                .details p { margin: 5px 0; display: flex; justify-content: space-between; }
                .total { border: 1px solid #000; padding: 12px; margin: 20px 0; font-size: 18px; font-weight: bold; background: #f9f9f9; }
                .footer { font-size: 11px; margin-top: 20px; color: #666; }
                
                /* Barre d'outils de la fenêtre */
                .toolbar { 
                    margin-bottom: 20px; 
                    display: flex; 
                    gap: 10px; 
                }
                .btn { 
                    padding: 10px 20px; 
                    cursor: pointer; 
                    border-radius: 5px; 
                    font-weight: bold; 
                    border: none; 
                }
                .btn-print { background: #D4AF37; color: white; }
                .btn-close { background: #666; color: white; }

                /* Cacher la barre d'outils lors de l'impression réelle */
                @media print {
                    .toolbar { display: none; }
                    body { background: white; padding: 0; }
                    .ticket { box-shadow: none; width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <button class="btn btn-print" onclick="window.print()">🖨️ IMPRIMER LE REÇU</button>
                <button class="btn btn-close" onclick="window.close()">FERMER</button>
            </div>

            <div class="ticket">
                <img src="IMG_1959.jpg" style="width:80px; margin-bottom:10px;">
                <p class="brand">MRS.B BEAUTY</p>
                <p class="slogan">SOYEZ VOTRE STANDARD DE BEAUTÉ</p>
                <div class="hr"></div>
                
                <div class="details">
                    <p><span>DATE:</span> <span>${td[0].innerText}</span></p>
                    <p><span>CLIENT:</span> <span>${td[1].innerText}</span></p>
                    <p><span>ARTICLE:</span> <span style="text-align:right; max-width:180px;">${td[2].innerText} (${td[3].innerText})</span></p>
                    <p><span>PAIEMENT:</span> <span>${td[5].innerText}</span></p>
                </div>
                
                <div class="total">TOTAL : ${td[4].innerText} FCFA</div>
                
                <div class="hr"></div>
                <p class="footer">Merci de votre confiance !<br>Les articles vendus ne sont ni repris ni échangés.</p>
            </div>
        </body>
        </html>
    `);
    win.document.close();
};

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});