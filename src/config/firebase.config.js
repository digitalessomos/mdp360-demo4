import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDmIh5LbtMAg_D6fcVEUq4p6JP4yM8wtW8",
    authDomain: "mdp-vista-dely.firebaseapp.com",
    projectId: "mdp-vista-dely",
    storageBucket: "mdp-vista-dely.firebasestorage.app",
    messagingSenderId: "943402151930",
    appId: "1:943402151930:web:f86b82dfca89080d953e43",
    measurementId: "G-FSQPEDXT1R"
};

// Instancia por defecto (Admin / Panel Maestro)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Instancia aislada para Delivery (Evita cerrar sesión admin en el mismo navegador)
export const getDeliveryApp = () => {
    const apps = getApps();
    const deliveryApp = apps.find(a => a.name === "DeliveryApp");
    return deliveryApp || initializeApp(firebaseConfig, "DeliveryApp");
};

export { auth, db };
export const APP_ID = 'logistica-pro-360';
