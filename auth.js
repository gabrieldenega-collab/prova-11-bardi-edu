// Authentication Management Module
import { api, handleApiError } from './api.js';

class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.isLoading = true;
        this.listeners = [];
        
        this.init();
    }

    async init() {
        // Check if user has a stored token
        const token = localStorage.getItem('auth_token');
        if (token) {
            api.client.setToken(token);
            try {
                await this.validateToken();
            } catch (error) {
                console.warn('Token validation failed:', error);
                this.clearAuth();
            }
        } else {
            this.isLoading = false;
            this.notifyListeners();
        }
    }

    async validateToken() {
        try {
            const response = await api.getProfile();
            if (response.success && response.data.user) {
                this.setUser(response.data.user);
            } else {
                this.clearAuth();
            }
        } catch (error) {
            this.clearAuth();
            throw error;
        } finally {
            this.isLoading = false;
            this.notifyListeners();
        }
    }

    setUser(user) {
        this.user = user;
        this.isAuthenticated = true;
        this.notifyListeners();
    }

    clearAuth() {
        this.user = null;
        this.isAuthenticated = false;
        api.client.setToken(null);
        this.notifyListeners();
    }

    async login(email, password) {
        try {
            const response = await api.login(email, password);
            if (response.success && response.data.user) {
                this.setUser(response.data.user);
                
                // Dispatch success event
                window.dispatchEvent(new CustomEvent('ui:toast', {
                    detail: {
                        type: 'success',
                        message: 'Login realizado com sucesso!'
                    }
                }));
                
                return response;
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    }

    async register(name, email, password) {
        try {
            const response = await api.register(name, email, password);
            if (response.success && response.data.user) {
                this.setUser(response.data.user);
                
                // Dispatch success event
                window.dispatchEvent(new CustomEvent('ui:toast', {
                    detail: {
                        type: 'success',
                        message: 'Conta criada com sucesso!'
                    }
                }));
                
                return response;
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    }

    logout() {
        api.logout();
        this.clearAuth();
        
        // Dispatch logout event
        window.dispatchEvent(new CustomEvent('ui:toast', {
            detail: {
                type: 'info',
                message: 'Logout realizado com sucesso'
            }
        }));
        
        // Navigate to login
        window.dispatchEvent(new CustomEvent('router:navigate', {
            detail: { path: '/login' }
        }));
    }

    // Listener management for reactive updates
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback({
                    user: this.user,
                    isAuthenticated: this.isAuthenticated,
                    isLoading: this.isLoading
                });
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    // Route guard
    requireAuth() {
        if (!this.isAuthenticated && !this.isLoading) {
            window.dispatchEvent(new CustomEvent('router:navigate', {
                detail: { path: '/login' }
            }));
            return false;
        }
        return true;
    }

    // Form validation helpers
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password && password.length >= 6;
    }

    validateName(name) {
        return name && name.trim().length >= 2;
    }

    // Get user initials for avatar
    getUserInitials() {
        if (!this.user?.name) return 'U';
        return this.user.name
            .split(' ')
            .map(name => name[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    // Check user permissions
    canManageGroup(group) {
        if (!this.user || !group) return false;
        return group.owner_id === this.user.id;
    }

    canDeleteMentorship(mentorship) {
        if (!this.user || !mentorship) return false;
        return mentorship.created_by === this.user.id;
    }

    canDeleteMaterial(material) {
        if (!this.user || !material) return false;
        return material.uploaded_by === this.user.id;
    }
}

// Form handling utilities
class AuthForms {
    static createLoginForm() {
        return `
            <form id="login-form" class="login-form" novalidate>
                <div class="form-group">
                    <label for="email">E-mail</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        autocomplete="email"
                        placeholder="seu.email@exemplo.com"
                    >
                    <span class="input-error" id="email-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="password">Senha</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        required 
                        autocomplete="current-password"
                        placeholder="Digite sua senha"
                    >
                    <span class="input-error" id="password-error"></span>
                </div>
                
                <button type="submit" class="btn btn-primary" id="login-submit">
                    <span class="btn-text">Entrar</span>
                    <span class="btn-loading hidden">
                        <span class="spinner"></span>
                        Entrando...
                    </span>
                </button>
            </form>
        `;
    }

    static createRegisterForm() {
        return `
            <form id="register-form" class="register-form" novalidate>
                <div class="form-group">
                    <label for="name">Nome completo</label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        required 
                        autocomplete="name"
                        placeholder="Seu nome completo"
                    >
                    <span class="input-error" id="name-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="email">E-mail</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        autocomplete="email"
                        placeholder="seu.email@exemplo.com"
                    >
                    <span class="input-error" id="email-error"></span>
                </div>
                
                <div class="form-group">
                    <label for="password">Senha</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        required 
                        autocomplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                    >
                    <span class="input-error" id="password-error"></span>
                </div>
                
                <button type="submit" class="btn btn-primary" id="register-submit">
                    <span class="btn-text">Criar conta</span>
                    <span class="btn-loading hidden">
                        <span class="spinner"></span>
                        Criando...
                    </span>
                </button>
            </form>
        `;
    }

    static validateForm(form, auth) {
        let isValid = true;
        const errors = {};

        // Clear previous errors
        form.querySelectorAll('.input-error').forEach(error => {
            error.textContent = '';
        });
        form.querySelectorAll('input').forEach(input => {
            input.classList.remove('error');
        });

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validate name (for register form)
        if (data.name !== undefined) {
            if (!auth.validateName(data.name)) {
                errors.name = 'Nome deve ter pelo menos 2 caracteres';
                isValid = false;
            }
        }

        // Validate email
        if (!auth.validateEmail(data.email)) {
            errors.email = 'Digite um e-mail válido';
            isValid = false;
        }

        // Validate password
        if (!auth.validatePassword(data.password)) {
            errors.password = 'Senha deve ter pelo menos 6 caracteres';
            isValid = false;
        }

        // Display errors
        Object.entries(errors).forEach(([field, message]) => {
            const errorElement = form.querySelector(`#${field}-error`);
            const inputElement = form.querySelector(`#${field}`);
            if (errorElement) errorElement.textContent = message;
            if (inputElement) inputElement.classList.add('error');
        });

        return { isValid, data, errors };
    }

    static setLoading(form, isLoading) {
        const submit = form.querySelector('button[type="submit"]');
        const btnText = submit.querySelector('.btn-text');
        const btnLoading = submit.querySelector('.btn-loading');
        
        if (isLoading) {
            submit.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
        } else {
            submit.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    }
}

// Create global instance
const auth = new AuthManager();

// Listen to auth logout events
window.addEventListener('auth:logout', () => {
    auth.clearAuth();
});

// Make available globally and export for modules
window.auth = auth;
window.AuthForms = AuthForms;

export { auth, AuthForms };