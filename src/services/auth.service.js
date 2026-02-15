import { auth, db, getDeliveryApp } from '../config/firebase.config.js';
import { 
    getAuth,
    signInAnonymously, 
    onAuthStateChanged, 
    signOut, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore,
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

export const authService = {
    // Helpers para obtener las instancias correctas
    getAuthInstance(useDelivery = false) {
        if (!useDelivery) return auth;
        return getAuth(getDeliveryApp());
    },

    getDbInstance(useDelivery = false) {
        if (!useDelivery) return db;
        return getFirestore(getDeliveryApp());
    },

    async loginWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Google Login Error:", error);
            throw error;
        }
    },

    async loginWithPIN(pin, useDelivery = false) {
        if (!pin) throw new Error("PIN requerido");
        
        const targetAuth = this.getAuthInstance(useDelivery);
        const targetDb = this.getDbInstance(useDelivery);

        try {
            // 1. Autenticación anónima para cumplir con las reglas de Firebase
            await signInAnonymously(targetAuth);

            // 2. BUSQUEDA: Buscar el documento donde el campo 'pin' sea igual al ingresado
            const staffRef = collection(targetDb, 'staff_access');
            const q = query(staffRef, where("pin", "==", pin));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const staffData = docSnap.data();
                return { 
                    ...staffData, 
                    id: docSnap.id,
                    role: staffData.role || 'operativo',
                    name: (staffData.name || '').trim() || docSnap.id
                };
            } else {
                // Si el PIN no es válido, cerramos la sesión anónima
                await signOut(targetAuth);
                throw new Error("PIN incorrecto");
            }
        } catch (error) {
            console.error("PIN Login Error:", error);
            throw error;
        }
    },

    async checkAuthorization(email) {
        if (!email) return false;
        try {
            const userDoc = await getDoc(doc(db, 'authorized_users', email));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.role === 'admin';
            }
            return false;
        } catch (error) {
            console.error("Authorization Check Error:", error);
            return false;
        }
    },

    onAuthChange(callback, useDelivery = false) {
        const targetAuth = this.getAuthInstance(useDelivery);
        return onAuthStateChanged(targetAuth, callback);
    },

    async logout(useDelivery = false) {
        const targetAuth = this.getAuthInstance(useDelivery);
        return await signOut(targetAuth);
    },

    getCurrentUser(useDelivery = false) {
        const targetAuth = this.getAuthInstance(useDelivery);
        return targetAuth.currentUser;
    }
};
