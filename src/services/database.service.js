import { auth as adminAuth, db as adminDb, APP_ID, getDeliveryApp } from '../config/firebase.config.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Helper interno para obtener las instancias activas (Admin o Delivery)
const getContext = () => {
    if (adminAuth.currentUser) {
        return { auth: adminAuth, db: adminDb };
    }
    const deliveryApp = getDeliveryApp();
    const deliveryAuth = getAuth(deliveryApp);
    if (deliveryAuth.currentUser) {
        return { auth: deliveryAuth, db: getFirestore(deliveryApp) };
    }
    return { auth: adminAuth, db: adminDb };
};

export const databaseService = {
    subscribeToOrders(callback) {
        const { auth, db } = getContext();
        if (!auth.currentUser) {
            console.warn("Attempted to subscribe to orders without authentication.");
            return () => {};
        }
        const ordersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders');
        return onSnapshot(ordersRef, (snapshot) => {
            const orders = {};
            snapshot.forEach(doc => {
                orders[doc.id] = doc.data();
            });
            callback(orders);
        }, (error) => console.error("Orders Listener Error:", error));
    },

    subscribeToStaff(callback) {
        const { auth, db } = getContext();
        if (!auth.currentUser) {
            console.warn("Attempted to subscribe to staff without authentication.");
            return () => {};
        }
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'staff');
        return onSnapshot(configRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data().list || []);
            } else {
                const defaultStaff = ['Carlos M.', 'Ana R.', 'Mateo G.'];
                setDoc(configRef, { list: defaultStaff });
                callback(defaultStaff);
            }
        }, (error) => console.error("Staff Listener Error:", error));
    },

    async createOrder(id, repartidor = null) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        const newOrder = {
            id: parseInt(id),
            repartidor: repartidor || null,
            status: repartidor ? 'en ruta' : 'nuevo',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            serverTime: serverTimestamp()
        };
        await setDoc(orderRef, newOrder);
    },

    async assignOrder(id, repartidor) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            repartidor: repartidor || null,
            status: repartidor ? 'en ruta' : 'nuevo',
            timestamp: Date.now()
        });
    },

    async reportIncident(id, text) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            incident: text,
            incidentTime: Date.now(),
            response: null
        });
    },

    async respondToIncident(id, text) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            response: text,
            responseTime: Date.now()
        });
    },

    async finalizeOrder(id) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            status: 'entregado',
            timestamp: Date.now(),
            deliveredAt: serverTimestamp()
        });
    },

    async deleteOrder(id) {
        const { db } = getContext();
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await deleteDoc(orderRef);
    },

    async updateStaff(newList) {
        const { db } = getContext();
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config', 'staff');
        await setDoc(configRef, { list: newList });
    },

    async archiveAndClearAllOrders(orders) {
        const { db } = getContext();
        if (!orders || Object.keys(orders).length === 0) return;

        const batch = writeBatch(db);
        const now = new Date();
        const monthId = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        Object.entries(orders).forEach(([id, data]) => {
            const archiveRef = doc(db, 'artifacts', APP_ID, 'archive', monthId, 'orders', id.toString());
            batch.set(archiveRef, {
                ...data,
                archivedAt: serverTimestamp(),
                archiveMonth: monthId
            });

            const activeRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
            batch.delete(activeRef);
        });

        await batch.commit();
        console.log(`Modo Fantasma: ${Object.keys(orders).length} pedidos archivados en ${monthId}`);
    }
};
