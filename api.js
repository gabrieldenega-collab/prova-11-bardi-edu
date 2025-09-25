// API Configuration and HTTP Client
class ApiClient {
    constructor() {
        this.baseURL = window.location.origin; // Points to the current backend
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            // Handle different response types
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const error = new Error(data?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            if (error.status === 401) {
                // Token is invalid, clear it
                this.setToken(null);
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
            
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // HTTP Methods
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, body = null) {
        return this.request(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : null
        });
    }

    async put(endpoint, body = null) {
        return this.request(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : null
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// API Service Functions
class ApiService {
    constructor() {
        this.client = new ApiClient();
    }

    // Auth API
    async login(email, password) {
        const response = await this.client.post('/api/auth/login', {
            email,
            password
        });
        
        if (response.success && response.data.token) {
            this.client.setToken(response.data.token);
        }
        
        return response;
    }

    async register(name, email, password) {
        const response = await this.client.post('/api/auth/register', {
            name,
            email,
            password
        });
        
        if (response.success && response.data.token) {
            this.client.setToken(response.data.token);
        }
        
        return response;
    }

    async getProfile() {
        return this.client.get('/api/auth/profile');
    }

    logout() {
        this.client.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    // Groups API
    async getGroups() {
        return this.client.get('/api/groups');
    }

    async getGroup(groupId) {
        return this.client.get(`/api/groups/${groupId}`);
    }

    async createGroup(groupData) {
        return this.client.post('/api/groups', groupData);
    }

    async joinGroup(joinCode) {
        return this.client.post('/api/groups/join', { joinCode });
    }

    async leaveGroup(groupId) {
        return this.client.delete(`/api/groups/${groupId}/leave`);
    }

    // Mentorships API
    async getMentorships(groupId) {
        return this.client.get(`/api/groups/${groupId}/mentorships`);
    }

    async createMentorship(groupId, mentorshipData) {
        return this.client.post(`/api/groups/${groupId}/mentorships`, mentorshipData);
    }

    async updateMentorship(mentorshipId, mentorshipData) {
        return this.client.put(`/api/mentorships/${mentorshipId}`, mentorshipData);
    }

    async deleteMentorship(mentorshipId) {
        return this.client.delete(`/api/mentorships/${mentorshipId}`);
    }

    // Materials API
    async getMaterials(groupId) {
        return this.client.get(`/api/groups/${groupId}/materials`);
    }

    async createMaterial(groupId, materialData) {
        return this.client.post(`/api/groups/${groupId}/materials`, materialData);
    }

    async deleteMaterial(materialId) {
        return this.client.delete(`/api/materials/${materialId}`);
    }

    // Messages API
    async getMessages(groupId, limit = 30) {
        return this.client.get(`/api/groups/${groupId}/messages`, { limit });
    }

    async sendMessage(groupId, content) {
        return this.client.post(`/api/groups/${groupId}/messages`, { content });
    }

    // Health check
    async healthCheck() {
        return this.client.get('/api/health');
    }
}

// Error handling helper
function handleApiError(error, showToast = true) {
    let message = 'Ocorreu um erro inesperado';
    
    if (error.status === 401) {
        message = 'Sessão expirada. Faça login novamente.';
    } else if (error.status === 403) {
        message = 'Acesso negado.';
    } else if (error.status === 404) {
        message = 'Recurso não encontrado.';
    } else if (error.status === 400 && error.data?.error) {
        // Validation errors
        if (error.data.error.details) {
            message = Object.values(error.data.error.details)[0] || error.data.error.message;
        } else {
            message = error.data.error.message;
        }
    } else if (error.status >= 500) {
        message = 'Erro interno do servidor. Tente novamente mais tarde.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'Erro de conexão. Verifique sua internet.';
    } else if (error.data?.error?.message) {
        message = error.data.error.message;
    }

    if (showToast) {
        window.dispatchEvent(new CustomEvent('ui:toast', {
            detail: { type: 'error', message }
        }));
    }

    return message;
}

// Format date helper
function formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    };
    
    return date.toLocaleDateString('pt-BR', defaultOptions);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Create global instance
const api = new ApiService();

// Make available globally and export for modules
window.api = api;
window.handleApiError = handleApiError;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;

export { api, handleApiError, formatDate, formatDateTime, formatTime };