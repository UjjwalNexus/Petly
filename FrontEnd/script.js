class PetlyAuth {
    constructor() {
       this.apiBaseUrl = window.location.origin + '/api/auth';
       this.websocketUrl = window.location.origin.replace(/^http/, 'ws');

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        
        // Initialize WebSocket for real-time updates (admin only)
        if (window.location.pathname.includes('admin')) {
            this.initWebSocket();
        }
    }

    bindEvents() {
        // Sign Up Form
        const signUpForm = document.getElementById('signupForm');
        if (signUpForm) {
            signUpForm.addEventListener('submit', (e) => this.handleSignUp(e));
        }

        // Sign In Form
        const signInForm = document.getElementById('signinForm');
        if (signInForm) {
            signInForm.addEventListener('submit', (e) => this.handleSignIn(e));
        }

        // Toggle between Sign In and Sign Up
        const toggleLinks = document.querySelectorAll('.toggle-form');
        toggleLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleForms();
            });
        });
    }

    async handleSignUp(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('signupName').value,
            email: document.getElementById('signupEmail').value,
            password: document.getElementById('signupPassword').value,
            phone: document.getElementById('signupPhone').value,
            petType: document.getElementById('petType').value
        };

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Registering...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Store token and user data
                localStorage.setItem('petly_token', data.token);
                localStorage.setItem('petly_user', JSON.stringify(data.user));
                
                // Show success message
                this.showNotification('Registration successful! Welcome to Petly!', 'success');
                
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);
            } else {
                throw new Error(data.error || data.errors?.[0]?.msg || 'Registration failed');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
            console.error('Registration error:', error);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleSignIn(e) {
        e.preventDefault();
        
        const formData = {
            email: document.getElementById('signinEmail').value,
            password: document.getElementById('signinPassword').value
        };

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('petly_token', data.token);
                localStorage.setItem('petly_user', JSON.stringify(data.user));
                
                this.showNotification('Login successful!', 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                throw new Error(data.error || 'Invalid credentials');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async checkAuthStatus() {
        const token = localStorage.getItem('petly_token');
        if (token && window.location.pathname.includes('index.html')) {
            // User is logged in, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        });
    }

    toggleForms() {
        const authBox = document.querySelector('.auth-box');
        const welcomeSection = document.querySelector('.welcome-section');
        
        if (authBox.classList.contains('show-signup')) {
            authBox.classList.remove('show-signup');
            welcomeSection.querySelector('h2').textContent = 'Welcome Back!';
            welcomeSection.querySelector('p').textContent = 'Sign in to continue connecting with pet lovers and managing your pet\'s journey.';
        } else {
            authBox.classList.add('show-signup');
            welcomeSection.querySelector('h2').textContent = 'Join Petly Today!';
            welcomeSection.querySelector('p').textContent = 'Create an account to connect with pet lovers, share experiences, and get the best care for your furry friends.';
        }
    }

    // WebSocket for real-time updates (Admin Dashboard)
    initWebSocket() {
        const ws = new WebSocket(this.websocketUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            // Identify as admin
            ws.send(JSON.stringify({ type: 'admin' }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'NEW_REGISTRATION') {
                this.handleNewRegistration(data.data);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Try to reconnect after 3 seconds
            setTimeout(() => this.initWebSocket(), 3000);
        };
    }

    handleNewRegistration(userData) {
        // Update real-time counter
        const counter = document.getElementById('realtimeCounter');
        if (counter) {
            const current = parseInt(counter.textContent) || 0;
            counter.textContent = current + 1;
        }

        // Add to live registrations table
        const table = document.getElementById('liveRegistrations');
        if (table) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(userData.timestamp || Date.now()).toLocaleTimeString()}</td>
                <td>${userData.name}</td>
                <td>${userData.email}</td>
                <td>${userData.petType}</td>
                <td><span class="status-badge new">NEW</span></td>
            `;
            table.insertBefore(row, table.firstChild);
            
            // Remove oldest row if more than 10
            if (table.children.length > 10) {
                table.removeChild(table.lastChild);
            }
        }

        // Show notification
        this.showNotification(`New registration: ${userData.name} (${userData.petType} owner)`, 'success');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.petlyAuth = new PetlyAuth();
});

// Admin Dashboard Functions
if (window.location.pathname.includes('admin.html')) {
    class AdminDashboard {
        constructor() {
            this.apiBaseUrl = 'http://localhost:5000/api/auth';
            this.init();
        }

        async init() {
            await this.loadStats();
            await this.loadRecentUsers();
            this.initCharts();
            setInterval(() => this.loadStats(), 30000); // Refresh every 30 seconds
        }

        async loadStats() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/stats`);
                const data = await response.json();
                
                // Update stats cards
                document.getElementById('totalUsers').textContent = data.totalUsers;
                document.getElementById('todayRegistrations').textContent = data.todayRegistrations;
                
                // Update chart
                if (this.chart) {
                    this.updateChart(data.hourlyStats);
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        async loadRecentUsers() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/users`);
                const data = await response.json();
                
                const table = document.getElementById('usersTable');
                table.innerHTML = '';
                
                data.users.slice(0, 10).forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.phone || 'N/A'}</td>
                        <td>${user.petType}</td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    `;
                    table.appendChild(row);
                });
            } catch (error) {
                console.error('Failed to load users:', error);
            }
        }

        initCharts() {
            const ctx = document.getElementById('registrationsChart').getContext('2d');
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Registrations per Hour',
                        data: [],
                        borderColor: '#4A6FA5',
                        backgroundColor: 'rgba(74, 111, 165, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Registrations'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        }
                    }
                }
            });
        }

        updateChart(hourlyStats) {
            const labels = hourlyStats.map(stat => 
                `${stat._id.date} ${stat._id.hour}:00`
            );
            const data = hourlyStats.map(stat => stat.count);
            
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = data;
            this.chart.update();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        window.adminDashboard = new AdminDashboard();
    });
}