// SPA Router Module
import { auth } from './auth.js';
import { ui, Templates } from './ui.js';

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentParams = {};
        
        this.init();
    }

    init() {
        // Setup route definitions
        this.setupRoutes();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Handle initial route
        this.handleInitialRoute();
    }

    setupRoutes() {
        // Define all application routes
        this.routes.set('/', {
            handler: () => this.redirectToDefaultRoute(),
            requiresAuth: false
        });

        this.routes.set('/login', {
            handler: () => this.renderLogin(),
            requiresAuth: false,
            redirectIfAuth: '/dashboard'
        });

        this.routes.set('/register', {
            handler: () => this.renderRegister(),
            requiresAuth: false,
            redirectIfAuth: '/dashboard'
        });

        this.routes.set('/dashboard', {
            handler: () => this.renderDashboard(),
            requiresAuth: true
        });

        this.routes.set('/group/:id', {
            handler: (params) => this.renderGroup(params.id),
            requiresAuth: true
        });
    }

    setupEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleRoute(e.state?.path || window.location.pathname);
        });

        // Handle navigation events
        window.addEventListener('router:navigate', (e) => {
            this.navigate(e.detail.path, e.detail.replace);
        });

        // Handle auth state changes
        auth.addListener((authState) => {
            if (!authState.isLoading) {
                this.handleAuthStateChange(authState);
            }
        });

        // Handle link clicks for SPA navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="/"]');
            if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
        });
    }

    handleInitialRoute() {
        // Wait for auth to initialize before routing
        if (auth.isLoading) {
            const unsubscribe = auth.addListener((authState) => {
                if (!authState.isLoading) {
                    unsubscribe();
                    this.handleRoute(window.location.pathname);
                }
            });
        } else {
            this.handleRoute(window.location.pathname);
        }
    }

    handleAuthStateChange(authState) {
        // Redirect based on auth state if needed
        const currentPath = window.location.pathname;
        const route = this.findRoute(currentPath);
        
        if (route) {
            // If route requires auth but user is not authenticated
            if (route.requiresAuth && !authState.isAuthenticated) {
                this.navigate('/login', true);
                return;
            }
            
            // If route redirects when authenticated and user is authenticated
            if (route.redirectIfAuth && authState.isAuthenticated) {
                this.navigate(route.redirectIfAuth, true);
                return;
            }
        }
    }

    findRoute(path) {
        // First try exact match
        if (this.routes.has(path)) {
            return { ...this.routes.get(path), params: {} };
        }

        // Try pattern matching for parameterized routes
        for (const [pattern, route] of this.routes.entries()) {
            const params = this.matchRoute(pattern, path);
            if (params) {
                return { ...route, params };
            }
        }

        return null;
    }

    matchRoute(pattern, path) {
        // Convert route pattern to regex
        const paramNames = [];
        const regexPattern = pattern
            .replace(/:\w+/g, (match) => {
                paramNames.push(match.slice(1)); // Remove ':'
                return '([^/]+)';
            })
            .replace(/\//g, '\\/');

        const regex = new RegExp(`^${regexPattern}$`);
        const match = path.match(regex);

        if (match) {
            const params = {};
            paramNames.forEach((name, index) => {
                params[name] = match[index + 1];
            });
            return params;
        }

        return null;
    }

    async handleRoute(path) {
        const route = this.findRoute(path);
        
        if (!route) {
            this.render404();
            return;
        }

        // Check authentication requirements
        if (route.requiresAuth && !auth.isAuthenticated) {
            this.navigate('/login', true);
            return;
        }

        if (route.redirectIfAuth && auth.isAuthenticated) {
            this.navigate(route.redirectIfAuth, true);
            return;
        }

        // Set current route
        this.currentRoute = path;
        this.currentParams = route.params || {};

        // Execute route handler
        try {
            await route.handler(route.params);
        } catch (error) {
            console.error('Route handler error:', error);
            this.renderError('Erro ao carregar a página');
        }
    }

    navigate(path, replace = false) {
        if (path === this.currentRoute) {
            return; // Already on this route
        }

        // Update browser history
        if (replace) {
            window.history.replaceState({ path }, '', path);
        } else {
            window.history.pushState({ path }, '', path);
        }

        // Handle the route
        this.handleRoute(path);
    }

    redirectToDefaultRoute() {
        const defaultRoute = auth.isAuthenticated ? '/dashboard' : '/login';
        this.navigate(defaultRoute, true);
    }

    // Route Handlers
    async renderLogin() {
        try {
            this.renderPage(Templates.loginPage());
            this.setupLoginHandlers();
        } catch (error) {
            this.renderError('Erro ao carregar página de login');
        }
    }

    async renderRegister() {
        try {
            this.renderPage(Templates.registerPage());
            this.setupRegisterHandlers();
        } catch (error) {
            this.renderError('Erro ao carregar página de registro');
        }
    }

    async renderDashboard() {
        try {
            this.renderPage(Templates.dashboardPage());
            await this.loadDashboardData();
            this.setupDashboardHandlers();
        } catch (error) {
            this.renderError('Erro ao carregar dashboard');
        }
    }

    async renderGroup(groupId) {
        try {
            ui.toggleLoading(true, 'Carregando grupo...');
            
            const response = await api.getGroup(groupId);
            if (!response.success) {
                throw new Error('Grupo não encontrado');
            }

            this.renderPage(Templates.groupPage(response.data.group));
            await this.loadGroupData(groupId);
            this.setupGroupHandlers(groupId);
            
            // Start chat polling
            ui.startChatPolling(groupId);
            
        } catch (error) {
            this.renderError('Erro ao carregar grupo');
        } finally {
            ui.toggleLoading(false);
        }
    }

    render404() {
        this.renderPage(`
            <div class="container" style="text-align: center; padding: 4rem 1rem;">
                <h1>404</h1>
                <p>Página não encontrada</p>
                <a href="/dashboard" class="btn btn-primary">Voltar ao Dashboard</a>
            </div>
        `);
    }

    renderError(message) {
        this.renderPage(`
            <div class="container" style="text-align: center; padding: 4rem 1rem;">
                <h1>Erro</h1>
                <p>${message}</p>
                <a href="/dashboard" class="btn btn-primary">Voltar ao Dashboard</a>
            </div>
        `);
    }

    renderPage(html) {
        const app = document.getElementById('app');
        app.innerHTML = html;
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Update document title
        this.updateDocumentTitle();
    }

    updateDocumentTitle() {
        const titles = {
            '/login': 'Login - EduConnect',
            '/register': 'Criar Conta - EduConnect',
            '/dashboard': 'Dashboard - EduConnect'
        };
        
        if (this.currentRoute.startsWith('/group/')) {
            document.title = 'Grupo - EduConnect';
        } else {
            document.title = titles[this.currentRoute] || 'EduConnect';
        }
    }

    // Event Handler Setup Methods
    setupLoginHandlers() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const validation = AuthForms.validateForm(form, auth);
            if (!validation.isValid) return;

            try {
                AuthForms.setLoading(form, true);
                await auth.login(validation.data.email, validation.data.password);
                this.navigate('/dashboard');
            } catch (error) {
                // Error is handled by auth module
            } finally {
                AuthForms.setLoading(form, false);
            }
        });
    }

    setupRegisterHandlers() {
        const form = document.getElementById('register-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const validation = AuthForms.validateForm(form, auth);
            if (!validation.isValid) return;

            try {
                AuthForms.setLoading(form, true);
                await auth.register(validation.data.name, validation.data.email, validation.data.password);
                this.navigate('/dashboard');
            } catch (error) {
                // Error is handled by auth module
            } finally {
                AuthForms.setLoading(form, false);
            }
        });
    }

    setupDashboardHandlers() {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.logout();
            });
        }

        // Create group button
        const createGroupBtn = document.getElementById('create-group-btn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCreateGroupModal();
            });
        }

        // Join group button
        const joinGroupBtn = document.getElementById('join-group-btn');
        if (joinGroupBtn) {
            joinGroupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showJoinGroupModal();
            });
        }

        // Group card clicks
        document.addEventListener('click', (e) => {
            const groupCard = e.target.closest('.group-card');
            if (groupCard) {
                const groupId = groupCard.dataset.groupId;
                if (groupId) {
                    this.navigate(`/group/${groupId}`);
                }
            }
        });
    }

    setupGroupHandlers(groupId) {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.logout();
            });
        }

        // Tab navigation
        this.setupTabNavigation();

        // Create mentorship button
        const createMentorshipBtn = document.getElementById('create-mentorship-btn');
        if (createMentorshipBtn) {
            createMentorshipBtn.addEventListener('click', () => {
                this.showCreateMentorshipModal(groupId);
            });
        }

        // Create material button
        const createMaterialBtn = document.getElementById('create-material-btn');
        if (createMaterialBtn) {
            createMaterialBtn.addEventListener('click', () => {
                this.showCreateMaterialModal(groupId);
            });
        }

        // Chat functionality
        this.setupChatHandlers(groupId);
    }

    setupTabNavigation() {
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Update active states
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }

    setupChatHandlers(groupId) {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-message-btn');

        const sendMessage = async () => {
            const content = messageInput.value.trim();
            if (!content) return;

            try {
                sendBtn.disabled = true;
                await api.sendMessage(groupId, content);
                messageInput.value = '';
                
                // Refresh messages immediately
                await ui.refreshChatMessages(groupId);
            } catch (error) {
                handleApiError(error);
            } finally {
                sendBtn.disabled = false;
            }
        };

        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
    }

    // Data Loading Methods
    async loadDashboardData() {
        try {
            const response = await api.getGroups();
            if (response.success) {
                const container = document.getElementById('groups-container');
                if (container) {
                    container.innerHTML = Templates.groupsList(response.data.groups);
                }
            }
        } catch (error) {
            const container = document.getElementById('groups-container');
            if (container) {
                container.innerHTML = '<div class="text-center"><p>Erro ao carregar grupos</p></div>';
            }
        }
    }

    async loadGroupData(groupId) {
        // Load all group data in parallel
        try {
            const [mentorshipsRes, materialsRes, messagesRes] = await Promise.allSettled([
                api.getMentorships(groupId),
                api.getMaterials(groupId),
                api.getMessages(groupId, 30)
            ]);

            // Load mentorships
            const mentorshipsList = document.getElementById('mentorships-list');
            if (mentorshipsList) {
                if (mentorshipsRes.status === 'fulfilled' && mentorshipsRes.value.success) {
                    mentorshipsList.innerHTML = Templates.mentorshipsList(mentorshipsRes.value.data.mentorships);
                } else {
                    mentorshipsList.innerHTML = '<p>Erro ao carregar mentorias</p>';
                }
            }

            // Load materials
            const materialsList = document.getElementById('materials-list');
            if (materialsList) {
                if (materialsRes.status === 'fulfilled' && materialsRes.value.success) {
                    materialsList.innerHTML = Templates.materialsList(materialsRes.value.data.materials);
                } else {
                    materialsList.innerHTML = '<p>Erro ao carregar materiais</p>';
                }
            }

            // Load messages
            if (messagesRes.status === 'fulfilled' && messagesRes.value.success) {
                ui.renderChatMessages(messagesRes.value.data.messages);
            }
        } catch (error) {
            console.error('Error loading group data:', error);
        }
    }

    // Modal Methods
    showCreateGroupModal() {
        const modal = ui.showModal(Templates.createGroupModal(), {
            title: 'Criar Novo Grupo'
        });

        const form = modal.querySelector('#create-group-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                ui.setFormLoading(form, true);
                const response = await api.createGroup(data);
                
                if (response.success) {
                    ui.hideModal();
                    ui.showToast('Grupo criado com sucesso!', 'success');
                    await this.loadDashboardData();
                }
            } catch (error) {
                handleApiError(error);
            } finally {
                ui.setFormLoading(form, false);
            }
        });
    }

    showJoinGroupModal() {
        const modal = ui.showModal(Templates.joinGroupModal(), {
            title: 'Entrar no Grupo'
        });

        const form = modal.querySelector('#join-group-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                ui.setFormLoading(form, true);
                const response = await api.joinGroup(data.joinCode);
                
                if (response.success) {
                    ui.hideModal();
                    ui.showToast('Entrou no grupo com sucesso!', 'success');
                    await this.loadDashboardData();
                }
            } catch (error) {
                handleApiError(error);
            } finally {
                ui.setFormLoading(form, false);
            }
        });
    }

    showCreateMentorshipModal(groupId) {
        const modal = ui.showModal(Templates.createMentorshipModal(), {
            title: 'Agendar Nova Mentoria'
        });

        const form = modal.querySelector('#create-mentorship-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                ui.setFormLoading(form, true);
                const response = await api.createMentorship(groupId, data);
                
                if (response.success) {
                    ui.hideModal();
                    ui.showToast('Mentoria agendada com sucesso!', 'success');
                    await this.loadGroupData(groupId);
                }
            } catch (error) {
                handleApiError(error);
            } finally {
                ui.setFormLoading(form, false);
            }
        });
    }

    showCreateMaterialModal(groupId) {
        const modal = ui.showModal(Templates.createMaterialModal(), {
            title: 'Adicionar Novo Material'
        });

        const form = modal.querySelector('#create-material-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                ui.setFormLoading(form, true);
                const response = await api.createMaterial(groupId, data);
                
                if (response.success) {
                    ui.hideModal();
                    ui.showToast('Material adicionado com sucesso!', 'success');
                    await this.loadGroupData(groupId);
                }
            } catch (error) {
                handleApiError(error);
            } finally {
                ui.setFormLoading(form, false);
            }
        });
    }

    // Cleanup
    cleanup() {
        ui.cleanup();
    }
}

// Create global instance
const router = new Router();

// Make available globally and export for modules
window.router = router;

export { router };