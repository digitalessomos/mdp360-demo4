import { authService } from './services/auth.service.js';
import { databaseService } from './services/database.service.js';
import { uiManager } from './ui/ui.manager.js';
import { getURLs } from './config/urls.js';

// Global App State
window.AppState = {
    data: {
        orders: {},
        staff: [],
        currentUser: null,
        userRole: 'operativo'
    },
    update(key, payload) {
        this.data[key] = payload;
        uiManager.renderApp(this.data, handlers);
    }
};

// Handlers for UI actions
const handlers = {
    onCreateOrder: (id, rep) => databaseService.createOrder(id, rep).then(() => uiManager.playSound(rep ? "G4" : "E4")),
    onAssignOrder: (id, rep) => databaseService.assignOrder(id, rep).then(() => uiManager.playSound("G4")),
    onFinalizeOrder: (id) => databaseService.finalizeOrder(id).then(() => uiManager.playSound("C5")),
    onDeleteOrder: (id) => {
        if (window.AppState.data.userRole !== 'admin') {
            console.warn("Acción denegada: Solo administradores pueden borrar pedidos.");
            return Promise.resolve();
        }
        return databaseService.deleteOrder(id).then(() => uiManager.playSound("A2"));
    },
    onUpdateStaff: (list) => {
        if (window.AppState.data.userRole !== 'admin') {
            console.warn("Acción denegada: Solo administradores pueden gestionar la flota.");
            return Promise.resolve();
        }
        return databaseService.updateStaff(list);
    },
    onSignOut: () => authService.logout().finally(() => {
        localStorage.removeItem('rutatotal_role');
        const URLs = getURLs();
        window.location.href = URLs.login;
    })
};

// Initialize Application
const init = async () => {
    const loadingScreen = document.getElementById('loading-screen');
    
    authService.onAuthChange(async (user) => {
        if (user) {
            let role = localStorage.getItem('rutatotal_role') || 'operativo';
            let isAuthorized = false;

            if (user.isAnonymous) {
                // Si es anónimo, confiamos en que pasó por el flujo de PIN en login.html
                // y que el rol en localStorage es correcto. 
                isAuthorized = role === 'operativo';
            } else {
                // Si es Google Auth, verificamos en Firestore
                isAuthorized = await authService.checkAuthorization(user.email);
                role = isAuthorized ? 'admin' : null;
            }
            
            if (!isAuthorized) {
                console.warn("User authenticated but not authorized.");
                await authService.logout();
                const urls = getURLs();
                window.location.href = urls.login + '?error=unauthorized';
                return;
            }

            window.AppState.data.userRole = role; // Store role in state
            window.AppState.update('currentUser', user);
            
            const userDisplay = document.getElementById('user-display');
            if (userDisplay) {
                const displayName = user.isAnonymous ? localStorage.getItem('rutatotal_staff_name') : user.email;
                userDisplay.textContent = `${role.toUpperCase()} • ${displayName}`;
            }

            // Aplicar restricciones de rol antes de mostrar la app
            applyRoleRestrictions(role);

            // Subscribe to real-time data ONLY after verification
            databaseService.subscribeToOrders((orders) => window.AppState.update('orders', orders));
            databaseService.subscribeToStaff((staff) => window.AppState.update('staff', staff));

            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.style.display = 'none', 500);
            }
        } else {
            // No user, redirect to login if not already there
            const urls = getURLs();
            if (!window.location.pathname.includes(urls.login)) {
                window.location.href = urls.login;
            }
        }
    });

    // Inicilizamos sin login automático
};

function applyRoleRestrictions(role) {
    const isOperativo = role === 'operativo';
    
    // Elementos a ocultar/mostrar según rol
    const adminOnlyElements = [
        'download-pdf-btn',
        'clear-history-btn',
        'new-staff-name',
        'add-staff-btn'
    ];
    
    adminOnlyElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isOperativo ? 'none' : 'block';
    });

    // Gestionar mensaje de feedback
    const feedbackMsg = 'Funciones de administración solo para Encargados';
    const modalFooters = [
        { id: 'historyModal', footerSelector: '.mt-6' },
        { id: 'staffModal', footerSelector: '.modal-content' }
    ];

    modalFooters.forEach(config => {
        const modal = document.getElementById(config.id);
        if (modal) {
            let feedback = modal.querySelector('.role-feedback');
            if (!feedback && isOperativo) {
                feedback = document.createElement('p');
                feedback.className = 'role-feedback text-[10px] text-slate-500 font-bold uppercase mt-4 text-center w-full';
                feedback.textContent = feedbackMsg;
                modal.querySelector(config.footerSelector).appendChild(feedback);
            } else if (feedback) {
                feedback.style.display = isOperativo ? 'block' : 'none';
            }
        }
    });

    // Desbloquear botones de acceso a modales
    ['open-staff-modal-btn', 'open-history-modal-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    });
    
    if (isOperativo) console.log("Modo Operativo: Restricciones de acción aplicadas.");
}

// Event Listeners and Global Setup
window.onload = () => {
    init();

    // UI Event Listeners
    document.getElementById('prev-btn').onclick = () => uiManager.slideNumbers(-1, window.AppState.data);
    document.getElementById('next-btn').onclick = () => uiManager.slideNumbers(1, window.AppState.data);

    document.getElementById('history-search').oninput = (e) => {
        uiManager.setSearchQuery(e.target.value);
        uiManager.renderApp(window.AppState.data, handlers);
    };

    document.getElementById('theme-toggle').onclick = () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode', !document.body.classList.contains('light-mode'));
        document.getElementById('theme-text').textContent = document.body.classList.contains('light-mode') ? 'MODO OSCURO' : 'MODO CLARO';
    };

    document.getElementById('start-demo-btn').onclick = () => {
        const opsPanel = document.getElementById('ops-panel');
        const kanban = document.getElementById('kanban-container');
        const btn = document.getElementById('start-demo-btn');
        
        const isHidden = opsPanel.classList.contains('hidden');
        
        if (isHidden) {
            opsPanel.classList.remove('hidden');
            kanban.classList.remove('hidden');
            btn.innerHTML = '<i class="fas fa-power-off mr-2"></i>DESACTIVAR';
            btn.classList.add('bg-red-600', 'hover:bg-red-500');
            btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
            uiManager.renderApp(window.AppState.data, handlers);
        } else {
            opsPanel.classList.add('hidden');
            kanban.classList.add('hidden');
            btn.innerHTML = '<i class="fas fa-terminal mr-2"></i>ACTIVAR';
            btn.classList.remove('bg-red-600', 'hover:bg-red-500');
            btn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
        }
    };

    // Modal Listeners
    const togModal = (id, show) => {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = show ? 'flex' : 'none';
    };

    // Side Menu (Burger) Listeners
    const sideMenu = document.getElementById('side-menu');
    const sideOverlay = document.getElementById('side-menu-overlay');

    const togSideMenu = (show) => {
        if (!sideMenu || !sideOverlay) return;
        if (show) {
            sideOverlay.classList.remove('hidden');
            setTimeout(() => {
                sideOverlay.style.opacity = '1';
                sideMenu.classList.remove('translate-x-full');
            }, 10);
        } else {
            sideOverlay.style.opacity = '0';
            sideMenu.classList.add('translate-x-full');
            setTimeout(() => {
                sideOverlay.classList.add('hidden');
            }, 300);
        }
    };

    document.getElementById('burger-menu-btn').onclick = () => togSideMenu(true);
    document.getElementById('close-side-menu').onclick = () => togSideMenu(false);
    sideOverlay.onclick = () => togSideMenu(false);

    // Cerrar menú al hacer click en cualquier opción dentro
    sideMenu.querySelectorAll('button').forEach(btn => {
        const oldClick = btn.onclick;
        btn.onclick = (e) => {
            if (oldClick) oldClick(e);
            if (btn.id !== 'logoutBtn') togSideMenu(false); // No cerramos si es logout para ver la confirmación
        };
    });

    document.getElementById('open-staff-modal-btn').onclick = () => {
        uiManager.renderStaffListModal(window.AppState.data.staff, handlers.onUpdateStaff, window.AppState.data.userRole);
        togModal('staffModal', true);
    };
    document.getElementById('close-staff-modal-btn').onclick = () => togModal('staffModal', false);

    document.getElementById('open-history-modal-btn').onclick = () => {
        togModal('historyModal', true);
        uiManager.renderApp(window.AppState.data, handlers);
    };
    document.getElementById('close-history-modal-btn').onclick = () => togModal('historyModal', false);

    document.getElementById('add-staff-btn').onclick = () => {
        const v = document.getElementById('new-staff-name').value.trim();
        const cur = window.AppState.data.staff;
        if (v && !cur.includes(v)) {
            handlers.onUpdateStaff([...cur, v]);
            document.getElementById('new-staff-name').value = '';
            togModal('staffModal', false);
        }
    };

    document.getElementById('clear-history-btn').onclick = async () => {
        if (confirm("¿Activar Modo Fantasma? Se archivarán todos los pedidos actuales para auditoría y se limpiará el monitor.")) {
            try {
                await databaseService.archiveAndClearAllOrders(window.AppState.data.orders);
                uiManager.playSound("A2");
                alert("Operación completada: Monitor limpio y datos archivados.");
            } catch (error) {
                console.error("Error en Modo Fantasma:", error);
                alert("Error al archivar. El monitor no se ha limpiado.");
            }
        }
    };

    document.getElementById('download-pdf-btn').onclick = () => {
        uiManager.generatePDFReport(window.AppState.data.orders, window.AppState.data.staff);
    };

    document.getElementById('logoutBtn').onclick = () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión? Detendrás la sincronización en tiempo real.")) {
            handlers.onSignOut();
        }
    };

    // Loading screen fade out - handled in onAuthChange
    /*
    setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        if (ls) {
            ls.style.opacity = '0';
            setTimeout(() => ls.style.display = 'none', 500);
        }
    }, 1000);
    */
};
