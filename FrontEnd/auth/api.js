// frontend/api.js
// Minimal, honest API layer for Petly

(() => {
  const API_BASE = 'http://localhost:5000/api';

  const api = {
    currentUser: null,

    /* =========================
       INIT
    ========================== */
    init() {
      this.loadUserFromStorage();
      this.checkHealth();
      return this;
    },

    /* =========================
       HEALTH CHECK
    ========================== */
    async checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) throw new Error('Health check failed');
        console.log('✅ Backend connected');
        return true;
      } catch (err) {
        console.error('❌ Backend not reachable');
        this.showError(
          'Backend server is not running on http://localhost:5000'
        );
        return false;
      }
    },

    /* =========================
       AUTH
    ========================== */
    async register(formData) {
      try {
        const res = await fetch(`${API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, message: data.error || 'Registration failed' };
        }

        this.saveUser(data.user);
        return { success: true, user: data.user };
      } catch (err) {
        return {
          success: false,
          message: 'Cannot connect to backend',
        };
      }
    },

    async login(email, password) {
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, message: data.error || 'Login failed' };
        }

        this.saveUser(data.user);
        return { success: true, user: data.user };
      } catch (err) {
        return {
          success: false,
          message: 'Cannot connect to backend',
        };
      }
    },

    logout() {
      localStorage.removeItem('petly_user');
      this.currentUser = null;
      return { success: true };
    },

    /* =========================
       USER STATE
    ========================== */
    saveUser(user) {
      this.currentUser = user;
      localStorage.setItem('petly_user', JSON.stringify(user));
    },

    loadUserFromStorage() {
      const raw = localStorage.getItem('petly_user');
      if (!raw) return null;

      try {
        this.currentUser = JSON.parse(raw);
        return this.currentUser;
      } catch {
        localStorage.removeItem('petly_user');
        return null;
      }
    },

    isLoggedIn() {
      return !!this.currentUser;
    },

    getUser() {
      return this.currentUser;
    },

    /* =========================
       UI HELPERS
    ========================== */
    showError(message) {
      const el = document.getElementById('errorMessage');
      if (!el) return;

      el.textContent = message;
      el.classList.add('show');
    },
  };

  // Expose globally
  window.petCareAPI = api;

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    api.init();
  });
})();
