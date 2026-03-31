/**
 * Odontonil Premium Mobile Utilities
 * - Global Toast System
 * - Haptic System (Android Only, but future-proofed)
 */

const MobileUtils = {
    installPromptEvent: null,
    uxHintMounted: false,

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

    getDeviceContext() {
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);
        const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        const isChrome = /Chrome|CriOS/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua);
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

        return {
            isIOS,
            isAndroid,
            isSafari,
            isChrome,
            isStandalone,
        };
    },

    ensureUXHintStyles() {
        if (document.getElementById('ux-hint-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'ux-hint-styles';
        style.textContent = `
            #ux-hint-root {
                position: fixed;
                left: 0;
                right: 0;
                bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
                z-index: 70;
                display: flex;
                justify-content: center;
                padding: 0 1rem;
                pointer-events: none;
            }
            .ux-hint-card {
                width: min(100%, 30rem);
                background: rgba(255, 255, 255, 0.94);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 1px solid rgba(191, 201, 196, 0.45);
                border-radius: 1.35rem;
                box-shadow: 0 16px 32px rgba(15, 23, 42, 0.14);
                padding: 1rem;
                pointer-events: auto;
            }
            .ux-hint-kicker {
                font-size: 0.72rem;
                font-weight: 700;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                color: #466270;
                margin-bottom: 0.35rem;
            }
            .ux-hint-title {
                font-size: 1rem;
                font-weight: 800;
                line-height: 1.2;
                color: #00342b;
                margin: 0 0 0.45rem;
            }
            .ux-hint-message {
                font-size: 0.9rem;
                line-height: 1.45;
                color: #3f4945;
                margin: 0;
            }
            .ux-hint-actions {
                display: grid;
                grid-template-columns: 1fr;
                gap: 0.65rem;
                margin-top: 0.9rem;
            }
            .ux-hint-button {
                min-height: 2.9rem;
                border-radius: 0.95rem;
                font-weight: 700;
                padding: 0.75rem 1rem;
                transition: transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease;
            }
            .ux-hint-button:active {
                transform: scale(0.98);
            }
            .ux-hint-button.primary {
                background: #00342b;
                color: #fff;
                box-shadow: 0 10px 18px rgba(0, 52, 43, 0.18);
            }
            .ux-hint-button.secondary {
                background: #f2f4f4;
                color: #00342b;
            }
            @media (min-width: 640px) {
                .ux-hint-actions {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
        `;
        document.head.appendChild(style);
    },

    buildChromeIntentUrl() {
        if (!/^https?:/i.test(window.location.href)) {
            return '';
        }

        const url = new URL(window.location.href);
        const pathWithQuery = `${url.host}${url.pathname}${url.search}${url.hash}`;
        return `intent://${pathWithQuery}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
    },

    buildUXHint() {
        const context = this.getDeviceContext();
        if (context.isStandalone) {
            return null;
        }

        if (context.isIOS && !context.isSafari) {
            return {
                id: 'ios-open-safari',
                kicker: 'Melhor experiencia',
                title: 'No iPhone, prefira abrir no Safari',
                message: 'Assim fica mais estavel e voce ainda pode adicionar o sistema na tela inicial depois.',
                primaryLabel: 'Entendi',
                secondaryLabel: null,
                onPrimary: () => this.dismissUXHint('ios-open-safari'),
            };
        }

        if (context.isIOS && context.isSafari) {
            return {
                id: 'ios-add-home',
                kicker: 'Dica do iPhone',
                title: 'Adicione a tela inicial',
                message: 'No Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio para usar com cara de app.',
                primaryLabel: 'Entendi',
                secondaryLabel: null,
                onPrimary: () => this.dismissUXHint('ios-add-home'),
            };
        }

        if (context.isAndroid && !context.isChrome) {
            return {
                id: 'android-open-chrome',
                kicker: 'Melhor experiencia',
                title: 'No Android, o Chrome costuma funcionar melhor',
                message: 'Ele costuma entregar uma experiencia mais consistente para abrir, instalar e usar o sistema no celular.',
                primaryLabel: 'Abrir no Chrome',
                secondaryLabel: 'Continuar aqui',
                onPrimary: () => {
                    const intentUrl = this.buildChromeIntentUrl();
                    if (intentUrl) {
                        window.location.href = intentUrl;
                    }
                    this.dismissUXHint('android-open-chrome');
                },
                onSecondary: () => this.dismissUXHint('android-open-chrome'),
            };
        }

        if (context.isAndroid && context.isChrome && this.installPromptEvent) {
            return {
                id: 'android-install',
                kicker: 'Atalho rapido',
                title: 'Instale como app',
                message: 'No Chrome voce pode instalar o sistema e abrir direto da tela inicial, com experiencia mais fluida.',
                primaryLabel: 'Instalar',
                secondaryLabel: 'Agora nao',
                onPrimary: async () => {
                    const promptEvent = this.installPromptEvent;
                    if (!promptEvent) {
                        this.dismissUXHint('android-install');
                        return;
                    }
                    promptEvent.prompt();
                    await promptEvent.userChoice.catch(() => null);
                    this.installPromptEvent = null;
                    this.dismissUXHint('android-install');
                },
                onSecondary: () => this.dismissUXHint('android-install'),
            };
        }

        return null;
    },

    dismissUXHint(id) {
        if (id) {
            localStorage.setItem(`odontonil:uxhint:${id}`, '1');
        }

        const root = document.getElementById('ux-hint-root');
        if (root) {
            root.remove();
        }
    },

    renderUXHint() {
        const hint = this.buildUXHint();
        const existingRoot = document.getElementById('ux-hint-root');

        if (!hint || localStorage.getItem(`odontonil:uxhint:${hint.id}`) === '1') {
            existingRoot?.remove();
            return;
        }

        this.ensureUXHintStyles();
        existingRoot?.remove();

        const root = document.createElement('div');
        root.id = 'ux-hint-root';

        const card = document.createElement('div');
        card.className = 'ux-hint-card';

        const kicker = document.createElement('p');
        kicker.className = 'ux-hint-kicker';
        kicker.textContent = hint.kicker;

        const title = document.createElement('h3');
        title.className = 'ux-hint-title';
        title.textContent = hint.title;

        const message = document.createElement('p');
        message.className = 'ux-hint-message';
        message.textContent = hint.message;

        const actions = document.createElement('div');
        actions.className = 'ux-hint-actions';

        const primary = document.createElement('button');
        primary.type = 'button';
        primary.className = 'ux-hint-button primary';
        primary.textContent = hint.primaryLabel;
        primary.addEventListener('click', () => hint.onPrimary?.());
        actions.appendChild(primary);

        if (hint.secondaryLabel) {
            const secondary = document.createElement('button');
            secondary.type = 'button';
            secondary.className = 'ux-hint-button secondary';
            secondary.textContent = hint.secondaryLabel;
            secondary.addEventListener('click', () => hint.onSecondary?.());
            actions.appendChild(secondary);
        }

        card.append(kicker, title, message, actions);
        root.appendChild(card);
        document.body.appendChild(root);
    },

    // 3. Auto-attach to interactive elements marked with 'data-haptic'
    init() {
        if (!this.uxHintMounted) {
            this.uxHintMounted = true;

            window.addEventListener('beforeinstallprompt', (event) => {
                event.preventDefault();
                this.installPromptEvent = event;
                this.renderUXHint();
            });

            window.addEventListener('appinstalled', () => {
                this.installPromptEvent = null;
                this.dismissUXHint('android-install');
            });

            this.renderUXHint();
        }

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
