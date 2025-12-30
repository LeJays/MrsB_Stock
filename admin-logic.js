import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
    serverTimestamp, getDocs, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

let myChart;

// --- NOUVEAU : ALERTE DE STOCK FAIBLE AU DÉMARRAGE ---
async function verifierAlertesStock() {
    const catSnap = await getDocs(collection(db, "categories"));
    const entreesSnap = await getDocs(collection(db, "entrees"));
    const sortiesSnap = await getDocs(collection(db, "sorties"));

    let produitsCritiques = [];

    catSnap.forEach(catDoc => {
        const catNom = catDoc.data().nom;
        let tE = 0; let tS = 0;
        entreesSnap.forEach(e => { if(e.data().categorie === catNom) tE += (e.data().quantite || 0); });
        sortiesSnap.forEach(s => { if(s.data().categorie === catNom) tS += (s.data().quantite || 0); });
        
        const reste = tE - tS;
        if (reste <= 5) {
            produitsCritiques.push(`${catNom} (Reste : ${reste})`);
        }
    });

    if (produitsCritiques.length > 0) {
        alert("⚠️ ALERTE STOCK FAIBLE ⚠️\n\nLes articles suivants sont presque épuisés (5 ou moins) :\n\n" + produitsCritiques.join("\n"));
    }
}

setTimeout(verifierAlertesStock, 2000);

// --- NAVIGATION ---
window.showSection = function(sectionId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(sectionId + 'Section');
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if(item.getAttribute('onclick')?.includes(sectionId)) item.classList.add('active');
    });

    if(sectionId === 'stock') chargerEtatStock();
};

// --- GRAPHIQUE ---
function initChart(labels, dataSales, dataExpenses) {
    const ctx = document.getElementById('beneficeChart')?.getContext('2d');
    if (!ctx) return;
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventes',
                    data: dataSales,
                    borderColor: '#D4AF37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Dépenses',
                    data: dataExpenses,
                    borderColor: '#A0A0A0',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#A0A0A0' } },
                x: { grid: { color: '#333' }, ticks: { color: '#A0A0A0' } }
            }
        }
    });
}

// --- ÉTAT DU STOCK (DÉTAILLÉ) ---
async function chargerEtatStock() {
    const table = document.getElementById('listStockTable');
    if (!table) return;
    table.innerHTML = "<tr><td colspan='5'>Chargement...</td></tr>";

    const catSnap = await getDocs(collection(db, "categories"));
    const entreesSnap = await getDocs(collection(db, "entrees"));
    const sortiesSnap = await getDocs(collection(db, "sorties"));

    let html = "";
    catSnap.forEach(catDoc => {
        const catNom = catDoc.data().nom;
        let tE = 0; let tS = 0;
        entreesSnap.forEach(e => { if(e.data().categorie === catNom) tE += (e.data().quantite || 0); });
        sortiesSnap.forEach(s => { if(s.data().categorie === catNom) tS += (s.data().quantite || 0); });
        const reste = tE - tS;
        const statut = reste <= 5 ? "<span style='color:#ff4444; font-weight:bold;'>URGENT</span>" : "<span style='color:#00C851;'>OK</span>";
        html += `<tr><td>${catNom}</td><td>${tE}</td><td>${tS}</td><td><strong>${reste}</strong></td><td>${statut}</td></tr>`;
    });
    table.innerHTML = html;
}

// --- CATEGORIES ---
onSnapshot(collection(db, "categories"), (snap) => {
    const table = document.getElementById('listCategoriesTable');
    const selE = document.getElementById('entreeCat');
    const selS = document.getElementById('sortieCat');
    if (table) table.innerHTML = "";
    if (selE) selE.innerHTML = '<option value="">Choisir...</option>';
    if (selS) selS.innerHTML = '<option value="">Choisir...</option>';
    snap.forEach(doc => {
        const cat = doc.data();
        if (table) table.innerHTML += `<tr><td>${cat.nom}</td><td>${cat.description}</td></tr>`;
        if (selE) selE.innerHTML += `<option value="${cat.nom}">${cat.nom}</option>`;
        if (selS) selS.innerHTML += `<option value="${cat.nom}">${cat.nom}</option>`;
    });
});

document.getElementById('formCat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "categories"), {
        nom: document.getElementById('catNom').value,
        description: document.getElementById('catDesc').value
    });
    e.target.reset();
});

// --- FINANCE & GRAPHES (MODIFIÉ POUR AJOUTER LES NOUVELLES ANALYSES) ---
function syncFinanceAndGraph() {
    onSnapshot(query(collection(db, "sorties"), orderBy("timestamp", "asc")), (snapS) => {
        onSnapshot(query(collection(db, "entrees"), orderBy("timestamp", "asc")), (snapE) => {
            let totalS = 0; let totalE = 0;
            let graphData = {};
            
            // AJOUT : Variables pour nouvelles analyses
            let nbVentes = snapS.size;
            let paiements = { "Cash": 0, "Orange Money": 0, "MTN MoMo": 0 };

            snapS.forEach(doc => {
                const d = doc.data(); 
                totalS += (d.montant || 0);
                
                // AJOUT : Calcul par mode de paiement
                if(paiements[d.paiement] !== undefined) paiements[d.paiement] += d.montant;
                
                if(!graphData[d.date]) graphData[d.date] = { s: 0, e: 0 };
                graphData[d.date].s += (d.montant || 0);
            });

            snapE.forEach(doc => {
                const d = doc.data(); totalE += (d.montant || 0);
                if(!graphData[d.date]) graphData[d.date] = { s: 0, e: 0 };
                graphData[d.date].e += (d.montant || 0);
            });

            if(document.getElementById('totalEntreesStat')){
                document.getElementById('totalEntreesStat').innerText = totalE.toLocaleString();
                document.getElementById('totalSortiesStat').innerText = totalS.toLocaleString();
                document.getElementById('beneficeNetStat').innerText = (totalS - totalE).toLocaleString();
                document.getElementById('finVentes').innerText = totalS.toLocaleString();
                document.getElementById('finDepenses').innerText = totalE.toLocaleString();
                document.getElementById('finBenefice').innerText = (totalS - totalE).toLocaleString();
                
                // AJOUT : Mise à jour des nouveaux éléments Finance
                if(document.getElementById('finPanierMoyen')){
                    document.getElementById('finPanierMoyen').innerText = nbVentes > 0 ? Math.round(totalS/nbVentes).toLocaleString() : 0;
                    document.getElementById('statsCash').innerText = paiements["Cash"].toLocaleString();
                    document.getElementById('statsOM').innerText = paiements["Orange Money"].toLocaleString();
                    document.getElementById('statsMomo').innerText = paiements["MTN MoMo"].toLocaleString();
                }
            }

            const labels = Object.keys(graphData);
            const sales = labels.map(l => graphData[l].s);
            const expenses = labels.map(l => graphData[l].e);
            initChart(labels, sales, expenses);
        });
    });
}
syncFinanceAndGraph();

// --- FORMULAIRE ENTREE ---
document.getElementById('formEntree')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "entrees"), {
        categorie: document.getElementById('entreeCat').value,
        quantite: parseInt(document.getElementById('entreeQty').value),
        montant: parseFloat(document.getElementById('entreeMontant').value),
        date: new Date().toLocaleDateString('fr-FR'),
        timestamp: serverTimestamp()
    });
    alert("Entrée enregistrée");
    e.target.reset();
});

// --- VENTE AVEC VÉRIFICATION DU STOCK ---
document.getElementById('formSortie')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('sortieCat').value;
    const qteDemandee = parseInt(document.getElementById('sortieQty').value);

    const eSnap = await getDocs(query(collection(db, "entrees"), where("categorie", "==", cat)));
    const sSnap = await getDocs(query(collection(db, "sorties"), where("categorie", "==", cat)));
    
    let totalE = 0; let totalS = 0;
    eSnap.forEach(d => totalE += d.data().quantite);
    sSnap.forEach(d => totalS += d.data().quantite);
    
    const dispo = totalE - totalS;

    if (qteDemandee > dispo) {
        alert("ACTION IMPOSSIBLE : Stock insuffisant !\nDisponible : " + dispo + " unité(s)");
        return;
    }

    await addDoc(collection(db, "sorties"), {
        client: document.getElementById('sortieClient').value,
        categorie: cat,
        produitNom: document.getElementById('sortieProduitNom').value,
        quantite: qteDemandee,
        montant: parseFloat(document.getElementById('sortiePrix').value),
        paiement: document.getElementById('sortiePaiement').value,
        date: new Date().toLocaleDateString('fr-FR'),
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp()
    });
    alert("Vente enregistrée !");
    e.target.reset();
});

// --- DANS admin-logic.js (Section LISTE DES VENTES) ---
onSnapshot(query(collection(db, "sorties"), orderBy("timestamp", "desc")), (snap) => {
    const t = document.getElementById('listSortiesTable');
    if(t) {
        t.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            t.innerHTML += `<tr>
                <td>${d.date} à ${d.heure || ''}</td>
                <td>${d.vendeurNom || 'Admin'}</td> <td>${d.client}</td>
                <td><strong>${d.categorie}</strong> - ${d.produitNom}</td>
                <td>${d.quantite}</td>
                <td>${d.montant.toLocaleString()}</td>
                <td>${d.paiement}</td>
                <td><button class="btn-gold-outline" onclick="imprimerRecu('${doc.id}')">Reçu</button></td>
            </tr>`;
        });
    }
});

onSnapshot(query(collection(db, "entrees"), orderBy("timestamp", "desc")), (snap) => {
    const t = document.getElementById('listEntreesTable');
    if(t) {
        t.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            t.innerHTML += `<tr><td>${d.date}</td><td>${d.categorie}</td><td>${d.quantite}</td><td>${d.montant.toLocaleString()}</td></tr>`;
        });
    }
});

// --- REÇU STYLE TICKET LUXE AVEC PRÉVISUALISATION ---
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
                <p class="slogan">SOYEZ VOTRE STANDARD DE BEAUTÉ!</p>
                <div class="hr"></div>
                
                <div class="details">
                    <p><span>DATE:</span> <span>${td[0].innerText}</span></p>
                    <p><span>CLIENT:</span> <span>${td[2].innerText}</span></p>
                    <p><span>ARTICLE:</span> <span style="text-align:right; max-width:180px;">${td[3].innerText} (x${td[4].innerText})</span></p>
                    <p><span>PAIEMENT:</span> <span>${td[6].innerText}</span></p>
                </div>
                
                <div class="total">TOTAL : ${td[5].innerText} FCFA</div>
                
                <div class="hr"></div>
                <p class="footer">Merci pour votre confiance !<br>Les articles vendus ne sont ni repris ni échangés.</p>
            </div>
        </body>
        </html>
    `);
    win.document.close();
};

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");

});

