/**
 * Odontonil Premium Mobile Utilities
 * - Global Toast System
 * - Haptic System (Android Only, but future-proofed)
 */

const MobileUtils = {
    // 1. Toast System
    toast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-item ${type}`;
        
        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info'
        };

        toast.innerHTML = `
            <span class="material-symbols-outlined toast-icon text-${type}">${icons[type]}</span>
            <div class="toast-message">${message}</div>
        `;

        container.appendChild(toast);

        // Auto-remove
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, duration);

        // Trigger vibration based on type
        if (type === 'error') this.haptic('error');
        else if (type === 'success') this.haptic('medium');
    },

    // 2. Haptic Feedback System
    haptic(type = 'light') {
        if (!('vibrate' in navigator)) return;

        switch (type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(25);
                break;
            case 'heavy':
                navigator.vibrate(50);
                break;
            case 'error':
                navigator.vibrate([30, 50, 30, 50, 30]);
                break;
            case 'bounce':
                navigator.vibrate([15, 30, 20]);
                break;
        }
    },

    // 3. Auto-attach to interactive elements marked with 'data-haptic'
    init() {
        document.addEventListener('click', (e) => {
            const hapticEl = e.target.closest('[data-haptic]');
            if (hapticEl) {
                const type = hapticEl.getAttribute('data-haptic') || 'light';
                this.haptic(type);
            }
        });
    }
};

// Initialize listeners
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MobileUtils.init());
} else {
    MobileUtils.init();
}

// Global exposure
window.showToast = (msg, type, dur) => MobileUtils.toast(msg, type, dur);
window.triggerHaptic = (type) => MobileUtils.haptic(type);
