// UI Components and Template Management
import { auth, AuthForms } from './auth.js';
import { api, handleApiError, formatDate, formatDateTime, formatTime } from './api.js';

class UIManager {
    constructor() {
        this.toasts = [];
        this.modals = [];
        this.chatPolling = null;
        this.currentGroupId = null;
        
        this.init();
    }

    init() {
        // Setup global event listeners
        this.setupGlobalEvents();
        this.setupToastContainer();
    }

    setupGlobalEvents() {
        // Toast events
        window.addEventListener('ui:toast', (e) => {
            this.showToast(e.detail.message, e.detail.type);
        });

        // Loading events
        window.addEventListener('ui:loading', (e) => {
            this.toggleLoading(e.detail.show, e.detail.message);
        });

        // Modal events
        window.addEventListener('ui:modal', (e) => {
            if (e.detail.action === 'show') {
                this.showModal(e.detail.content, e.detail.options);
            } else if (e.detail.action === 'hide') {
                this.hideModal();
            }
        });
    }

    // Toast Management
    setupToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" aria-label="Fechar">×</button>
        `;

        // Add to container
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        this.toasts.push(toast);

        // Setup close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto remove
        setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        return toast;
    }

    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts = this.toasts.filter(t => t !== toast);
            }, 300);
        }
    }

    getToastIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // Loading Management
    toggleLoading(show, message = 'Carregando...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = overlay.querySelector('p');
        
        if (show) {
            messageEl.textContent = message;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    // Modal Management
    showModal(content, options = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h2 class="modal-title">${options.title || ''}</h2>
                    <button class="modal-close" aria-label="Fechar modal">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        // Setup event handlers
        const closeBtn = overlay.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.hideModal(overlay));
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideModal(overlay);
            }
        });

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hideModal(overlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        document.body.appendChild(overlay);
        this.modals.push({ overlay, handleEscape });

        // Focus management
        const firstFocusable = overlay.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }

        return overlay;
    }

    hideModal(specificModal = null) {
        const modal = specificModal || this.modals[this.modals.length - 1];
        if (modal) {
            if (modal.overlay && modal.overlay.parentNode) {
                modal.overlay.parentNode.removeChild(modal.overlay);
            }
            if (modal.handleEscape) {
                document.removeEventListener('keydown', modal.handleEscape);
            }
            this.modals = this.modals.filter(m => m !== modal);
        }
    }

    // Form helpers
    clearFormErrors(form) {
        form.querySelectorAll('.input-error').forEach(error => {
            error.textContent = '';
        });
        form.querySelectorAll('input, textarea, select').forEach(input => {
            input.classList.remove('error');
        });
    }

    showFormErrors(form, errors) {
        Object.entries(errors).forEach(([field, message]) => {
            const errorElement = form.querySelector(`#${field}-error`);
            const inputElement = form.querySelector(`#${field}`);
            if (errorElement) errorElement.textContent = message;
            if (inputElement) inputElement.classList.add('error');
        });
    }

    setFormLoading(form, isLoading) {
        const submit = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, textarea, select');
        
        if (isLoading) {
            submit.disabled = true;
            inputs.forEach(input => input.disabled = true);
            submit.classList.add('loading');
        } else {
            submit.disabled = false;
            inputs.forEach(input => input.disabled = false);
            submit.classList.remove('loading');
        }
    }

    // Chat polling
    startChatPolling(groupId) {
        this.stopChatPolling();
        this.currentGroupId = groupId;
        
        this.chatPolling = setInterval(async () => {
            try {
                await this.refreshChatMessages(groupId);
            } catch (error) {
                console.warn('Chat polling error:', error);
            }
        }, 10000); // Poll every 10 seconds
    }

    stopChatPolling() {
        if (this.chatPolling) {
            clearInterval(this.chatPolling);
            this.chatPolling = null;
        }
    }

    async refreshChatMessages(groupId) {
        try {
            const response = await api.getMessages(groupId, 30);
            if (response.success) {
                this.renderChatMessages(response.data.messages);
            }
        } catch (error) {
            // Silently fail for polling
        }
    }

    renderChatMessages(messages) {
        const container = document.querySelector('.chat-messages');
        if (!container) return;

        const scrollAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
        
        container.innerHTML = messages.map(message => `
            <div class="message">
                <div class="message-header">
                    <span class="message-author">${this.escapeHtml(message.author_name)}</span>
                    <span class="message-time">${formatTime(message.created_at)}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.content)}</div>
            </div>
        `).join('');

        // Maintain scroll position
        if (scrollAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    // Template rendering helpers
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Generate user avatar
    generateAvatar(name) {
        const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
        const colors = ['#0066cc', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
        const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
        
        return `
            <div class="avatar" style="background-color: ${colors[colorIndex]}">
                ${initials}
            </div>
        `;
    }

    // Form validation
    validateRequired(value, fieldName) {
        if (!value || !value.trim()) {
            return `${fieldName} é obrigatório`;
        }
        return null;
    }

    validateEmail(email) {
        if (!email) return 'E-mail é obrigatório';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Digite um e-mail válido';
        }
        return null;
    }

    validatePassword(password) {
        if (!password) return 'Senha é obrigatória';
        if (password.length < 6) {
            return 'Senha deve ter pelo menos 6 caracteres';
        }
        return null;
    }

    validateDateTime(dateTime) {
        if (!dateTime) return 'Data e hora são obrigatórias';
        const date = new Date(dateTime);
        if (isNaN(date.getTime())) {
            return 'Data e hora inválidas';
        }
        if (date <= new Date()) {
            return 'Data e hora devem ser no futuro';
        }
        return null;
    }

    // Accessibility helpers
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Responsive helpers
    isMobile() {
        return window.innerWidth <= 768;
    }

    // Keyboard navigation helpers
    setupTabNavigation(container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }

    // Cleanup
    cleanup() {
        this.stopChatPolling();
        this.toasts.forEach(toast => this.removeToast(toast));
        this.modals.forEach(modal => this.hideModal(modal));
    }
}

// Template generators
class Templates {
    static loginPage() {
        return `
            <div class="login-container">
                <div class="card login-card">
                    <div class="card-header text-center">
                        <h1>EduConnect</h1>
                        <p>Entre em sua conta para continuar</p>
                    </div>
                    <div class="card-body">
                        ${AuthForms.createLoginForm()}
                        <div class="text-center mt-3">
                            <p>Não tem uma conta? 
                                <a href="/register" class="link">Criar conta</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static registerPage() {
        return `
            <div class="login-container">
                <div class="card login-card">
                    <div class="card-header text-center">
                        <h1>EduConnect</h1>
                        <p>Crie sua conta para começar</p>
                    </div>
                    <div class="card-body">
                        ${AuthForms.createRegisterForm()}
                        <div class="text-center mt-3">
                            <p>Já tem uma conta? 
                                <a href="/login" class="link">Fazer login</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static dashboardPage() {
        return `
            <div class="header">
                <div class="container">
                    <div class="header-content">
                        <a href="/dashboard" class="logo">EduConnect</a>
                        <div class="nav-actions">
                            <span>Olá, ${auth.user?.name || 'Usuário'}!</span>
                            <button class="btn btn-secondary btn-small" id="logout-btn">Sair</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="container dashboard">
                <div class="dashboard-actions">
                    <button class="btn btn-primary" id="create-group-btn" data-testid="button-create-group">Criar Grupo</button>
                    <button class="btn btn-secondary" id="join-group-btn" data-testid="button-join-group">Entrar com Código</button>
                </div>
                
                <div id="groups-container">
                    <div class="text-center">
                        <div class="spinner"></div>
                        <p>Carregando grupos...</p>
                    </div>
                </div>
            </div>
        `;
    }

    static groupsList(groups) {
        if (!groups || groups.length === 0) {
            return `
                <div class="text-center">
                    <h3>Nenhum grupo encontrado</h3>
                    <p>Crie um novo grupo ou entre em um existente usando o código.</p>
                </div>
            `;
        }

        return `
            <h2>Meus Grupos</h2>
            <div class="group-grid">
                ${groups.map(group => `
                    <div class="card group-card" data-group-id="${group.id}">
                        <div class="card-body">
                            <div class="group-info">
                                <h3>${ui.escapeHtml(group.name)}</h3>
                                <p>${ui.escapeHtml(group.description || '')}</p>
                                <div class="group-stats">
                                    <span>${group.member_count || 0} membros</span>
                                    <span>Código: ${group.join_code}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static groupPage(group) {
        return `
            <div class="header">
                <div class="container">
                    <div class="header-content">
                        <a href="/dashboard" class="logo">EduConnect</a>
                        <div class="nav-actions">
                            <a href="/dashboard" class="btn btn-secondary btn-small">← Dashboard</a>
                            <button class="btn btn-secondary btn-small" id="logout-btn">Sair</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="container group-page">
                <div class="group-header">
                    <h1>${ui.escapeHtml(group.name)}</h1>
                    <p>${ui.escapeHtml(group.description || '')}</p>
                    <div class="group-stats">
                        <span>${group.member_count || 0} membros</span>
                        <span>Código: ${group.join_code}</span>
                    </div>
                </div>
                
                <div class="tabs">
                    <ul class="tab-list" role="tablist">
                        <li><button class="tab active" data-tab="mentorships" role="tab">Mentorias</button></li>
                        <li><button class="tab" data-tab="materials" role="tab">Materiais</button></li>
                        <li><button class="tab" data-tab="chat" role="tab">Chat</button></li>
                    </ul>
                </div>
                
                <div class="tab-content active" id="mentorships-tab">
                    <div class="flex justify-between items-center mb-3">
                        <h2>Mentorias</h2>
                        <button class="btn btn-primary" id="create-mentorship-btn">Agendar Mentoria</button>
                    </div>
                    <div id="mentorships-list">
                        <div class="text-center">
                            <div class="spinner"></div>
                            <p>Carregando mentorias...</p>
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="materials-tab">
                    <div class="flex justify-between items-center mb-3">
                        <h2>Materiais</h2>
                        <button class="btn btn-primary" id="create-material-btn">Adicionar Material</button>
                    </div>
                    <div id="materials-list">
                        <div class="text-center">
                            <div class="spinner"></div>
                            <p>Carregando materiais...</p>
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="chat-tab">
                    <div class="mb-3">
                        <h2>Chat</h2>
                    </div>
                    <div class="chat-container">
                        <div class="chat-messages" id="chat-messages">
                            <div class="text-center">
                                <div class="spinner"></div>
                                <p>Carregando mensagens...</p>
                            </div>
                        </div>
                        <div class="chat-input">
                            <input type="text" placeholder="Digite sua mensagem..." id="message-input" maxlength="500">
                            <button class="btn btn-primary" id="send-message-btn">Enviar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static mentorshipsList(mentorships) {
        if (!mentorships || mentorships.length === 0) {
            return `
                <div class="text-center">
                    <p>Nenhuma mentoria agendada ainda.</p>
                </div>
            `;
        }

        return `
            <div class="item-list">
                ${mentorships.map(mentorship => `
                    <div class="list-item">
                        <div class="item-header">
                            <h3 class="item-title">${ui.escapeHtml(mentorship.title)}</h3>
                            <div class="item-meta">
                                ${formatDateTime(mentorship.scheduled_date)}
                            </div>
                        </div>
                        <p>${ui.escapeHtml(mentorship.description || '')}</p>
                        <div class="item-meta">
                            Mentor: ${ui.escapeHtml(mentorship.mentor_name)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static materialsList(materials) {
        if (!materials || materials.length === 0) {
            return `
                <div class="text-center">
                    <p>Nenhum material compartilhado ainda.</p>
                </div>
            `;
        }

        return `
            <div class="item-list">
                ${materials.map(material => `
                    <div class="list-item">
                        <div class="item-header">
                            <h3 class="item-title">${ui.escapeHtml(material.title)}</h3>
                            <div class="item-meta">
                                ${formatDate(material.created_at)}
                            </div>
                        </div>
                        <p>${ui.escapeHtml(material.description || '')}</p>
                        <div class="flex justify-between items-center mt-2">
                            <div class="item-meta">
                                Por: ${ui.escapeHtml(material.author_name)}
                            </div>
                            <a href="${material.url}" target="_blank" class="btn btn-small btn-secondary">
                                Ver Material
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static createGroupModal() {
        return `
            <form id="create-group-form" novalidate>
                <div class="form-group">
                    <label for="group-name">Nome do Grupo</label>
                    <input type="text" id="group-name" name="name" required maxlength="100">
                    <span class="input-error" id="name-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="group-description">Descrição</label>
                    <textarea id="group-description" name="description" rows="3" maxlength="500"></textarea>
                    <span class="input-error" id="description-error"></span>
                </div>
                
                <div class="form-group mb-0">
                    <button type="submit" class="btn btn-primary">Criar Grupo</button>
                </div>
            </form>
        `;
    }

    static joinGroupModal() {
        return `
            <form id="join-group-form" novalidate>
                <div class="form-group">
                    <label for="join-code">Código do Grupo</label>
                    <input type="text" id="join-code" name="joinCode" required maxlength="10" placeholder="Digite o código">
                    <span class="input-error" id="joinCode-error"></span>
                </div>
                
                <div class="form-group mb-0">
                    <button type="submit" class="btn btn-primary">Entrar no Grupo</button>
                </div>
            </form>
        `;
    }

    static createMentorshipModal() {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const minDateTime = tomorrow.toISOString().slice(0, 16);

        return `
            <form id="create-mentorship-form" novalidate>
                <div class="form-group">
                    <label for="mentorship-title">Título</label>
                    <input type="text" id="mentorship-title" name="title" required maxlength="200">
                    <span class="input-error" id="title-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="mentorship-description">Descrição</label>
                    <textarea id="mentorship-description" name="description" rows="3" maxlength="1000"></textarea>
                    <span class="input-error" id="description-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="mentorship-date">Data e Hora</label>
                    <input type="datetime-local" id="mentorship-date" name="scheduled_date" required min="${minDateTime}">
                    <span class="input-error" id="scheduled_date-error"></span>
                </div>
                
                <div class="form-group mb-0">
                    <button type="submit" class="btn btn-primary">Agendar Mentoria</button>
                </div>
            </form>
        `;
    }

    static createMaterialModal() {
        return `
            <form id="create-material-form" novalidate>
                <div class="form-group">
                    <label for="material-title">Título</label>
                    <input type="text" id="material-title" name="title" required maxlength="200">
                    <span class="input-error" id="title-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="material-description">Descrição</label>
                    <textarea id="material-description" name="description" rows="3" maxlength="1000"></textarea>
                    <span class="input-error" id="description-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="material-url">URL do Material</label>
                    <input type="url" id="material-url" name="url" required placeholder="https://...">
                    <span class="input-error" id="url-error"></span>
                </div>
                
                <div class="form-group mb-0">
                    <button type="submit" class="btn btn-primary">Adicionar Material</button>
                </div>
            </form>
        `;
    }
}

// Create global instance
const ui = new UIManager();

// Make available globally and export for modules
window.ui = ui;
window.Templates = Templates;

export { ui, Templates };