import { authService } from './services/auth.service.js';
import { databaseService } from './services/database.service.js';
import { getURLs } from './config/urls.js';

// 1. Estado Local
let currentUser = null;
let currentStaffName = null;
let activeTicketId = null;

const init = async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const driverDisplay = document.getElementById('driver-name-display');
    const URLs = getURLs();

    // Usar la instancia de Delivery (true) para el cambio de auth
    authService.onAuthChange(async (user) => {
        if (user) {
            currentUser = user;
            currentStaffName = localStorage.getItem('rutatotal_staff_name');

            if (!currentStaffName) {
                window.location.href = URLs.login;
                return;
            }

            if (driverDisplay) driverDisplay.textContent = currentStaffName;

            // Suscribirse a los pedidos (La suscripción de databaseService usa el auth actual)
            databaseService.subscribeToOrders((orders) => {
                renderOrders(orders);
                if (loadingScreen && loadingScreen.style.display !== 'none') {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => loadingScreen.style.display = 'none', 500);
                }
            });

        } else {
            console.warn("No session detected in DeliveryApp instance.");
            window.location.href = URLs.login;
        }
    }, true); // useDelivery = true

    // Eventos Globales
    const qrModal = document.getElementById('qr-modal');
    document.getElementById('qr-pay-btn').onclick = () => {
        qrModal.style.display = 'flex';
        playSound("G4");
    };

    document.getElementById('close-qr-modal').onclick = () => {
        qrModal.style.display = 'none';
    };

    qrModal.onclick = (e) => {
        if (e.target === qrModal) qrModal.style.display = 'none';
    };

    document.getElementById('logout-btn').onclick = () => {
        if (confirm("¿Cerrar sesión de repartidor?")) {
            authService.logout(true).then(() => {
                localStorage.removeItem('rutatotal_role');
                localStorage.removeItem('rutatotal_staff_name');
                window.location.href = URLs.login;
            });
        }
    };

    const incidentModal = document.getElementById('incident-modal');
    if (document.getElementById('close-modal')) {
        document.getElementById('close-modal').onclick = () => {
            incidentModal.style.display = 'none';
        };
    }

    document.querySelectorAll('.incident-opt').forEach(btn => {
        btn.onclick = () => {
            const opt = btn.getAttribute('data-opt');
            if (activeTicketId && opt) {
                // Cerramos instantáneamente para mayor agilidad (Control Brutal)
                incidentModal.style.display = 'none';
                playSound("D4");
                
                databaseService.reportIncident(activeTicketId, opt);
                activeTicketId = null;
            }
        };
    });
};

const renderOrders = (orders) => {
    const container = document.getElementById('orders-list');
    if (!container) return;
    
    container.innerHTML = '';

    const sortedOrders = Object.values(orders)
        .filter(o => {
            if (o.status === 'entregado') return false;
            if (!o.repartidor) return false;

            const searchRep = (currentStaffName || '').toLowerCase().trim();
            const orderRep = (o.repartidor || '').toLowerCase().trim();

            return orderRep === searchRep || orderRep.includes(searchRep) || searchRep.includes(orderRep);
        })
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (sortedOrders.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-slate-500 text-center animate-fade-in">
                <div class="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                    <i class="fas fa-check-circle text-2xl text-emerald-500/40"></i>
                </div>
                <p class="font-black text-xs uppercase tracking-widest text-slate-400">¡Ruta Completada!</p>
                <p class="text-[10px] mt-2 font-bold opacity-60">No tienes pedidos pendientes asignados en este momento.</p>
            </div>
        `;
        return;
    }

    sortedOrders.forEach(o => {
        const card = document.createElement('div');
        card.className = 'order-card animate-slide-up';

        let incidentContent = '';
        if (o.incident) {
            incidentContent = `
                <div class="incident-box bg-red-500/5 border-red-500/10 border p-4 rounded-xl mb-4">
                    <p class="incident-text text-red-500 text-xs font-bold leading-tight">
                        <i class="fas fa-exclamation-triangle mr-2"></i>${o.incident}
                    </p>
                    ${o.response ? `
                        <div class="response-box bg-emerald-500/10 border-emerald-500/20 border p-3 rounded-lg mt-3">
                            <p class="response-text text-emerald-500 text-[10px] font-black uppercase">
                                <span class="opacity-50 mr-1">T. CONTROL:</span> ${o.response}
                            </p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Orden de Entrega</span>
                    <span class="text-4xl font-black text-slate-800 font-mono tracking-tighter">#${o.id}</span>
                </div>
                <div class="text-right flex flex-col items-end">
                    <div class="bg-slate-100 px-3 py-1 rounded-full mb-2">
                        <span class="text-[10px] font-bold text-slate-500">${o.time}</span>
                    </div>
                    <span class="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-900 text-white tracking-widest">${o.repartidor}</span>
                </div>
            </div>
            
            ${incidentContent}

            <div class="flex gap-2 mt-2 pt-4 border-t border-slate-100">
                <button class="finalize-btn flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                    Confirmar Entrega
                </button>
                <button class="report-btn w-14 h-14 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all" title="Reportar Incidencia">
                    <i class="fas fa-comment-dots text-xl"></i>
                </button>
            </div>
        `;

        // Eventos
        card.querySelector('.finalize-btn').onclick = () => {
            if (confirm("¿Confirmas la entrega del pedido #" + o.id + "?")) {
                databaseService.finalizeOrder(o.id).then(() => {
                    playSound("C5");
                });
            }
        };

        card.querySelector('.report-btn').onclick = () => {
            activeTicketId = o.id;
            const modalTicketId = document.getElementById('modal-ticket-id');
            if (modalTicketId) modalTicketId.textContent = `#${o.id}`;
            const incidentModal = document.getElementById('incident-modal');
            if (incidentModal) incidentModal.style.display = 'flex';
        };

        container.appendChild(card);
    });
};

const playSound = (f) => {
    try {
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        if (Tone.context.state !== 'running') Tone.start();
        synth.triggerAttackRelease(f, "8n");
    } catch (e) {
        console.warn("Audio Context Error:", e);
    }
};

// Solo inicializar si estamos en la vista de delivery
if (document.getElementById('orders-list')) {
    init();
}
