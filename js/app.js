// FILE: js/app.js

/**
 * Main application logic for the Social Media Dashboard.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- DOM Elements ---
        elements: {
            // Auth
            metaLoginBtn: document.getElementById('meta-login-btn'),
            linkedinLoginBtn: document.getElementById('linkedin-login-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            userProfile: document.getElementById('user-profile'),
            userName: document.getElementById('user-name'),
            userAvatar: document.getElementById('user-avatar'),
            authButtons: document.querySelector('.auth-buttons'),

            // Areas
            loginPrompt: document.getElementById('login-prompt'),
            dashboardArea: document.getElementById('dashboard-area'),

            // Filters
            platformSelect: document.getElementById('platform-select'),
            monthSelect: document.getElementById('month-select'),
            yearSelect: document.getElementById('year-select'),
            dateRangePicker: document.getElementById('date-range-picker'), // Placeholder for a real picker
            applyFiltersBtn: document.getElementById('apply-filters-btn'),
            exportDataBtn: document.getElementById('export-data-btn'),

            // KPIs
            kpiReach: document.getElementById('kpi-reach'),
            kpiEngagements: document.getElementById('kpi-engagements'),
            kpiFollowers: document.getElementById('kpi-followers'),
            kpiVideoViews: document.getElementById('kpi-video-views'),

            // Content
            growthChartCanvas: document.getElementById('growth-chart'),
            performanceChartCanvas: document.getElementById('performance-chart'),
            topPostsContainer: document.getElementById('top-posts-container'),
            logsOutput: document.getElementById('logs-output'),
        },

        // --- State ---
        state: {
            isMetaLoggedIn: false,
            isLinkedInLoggedIn: false,
            activePlatform: 'all',
            dashboardData: null, // Will hold combined data from APIs
            charts: {
                growth: null,
                performance: null,
            }
        },

        // --- Initialization ---
        async init() {
            helpers.log('Dashboard initializing...');
            helpers.setFooterYear();
            helpers.populateDateFilters();
            this.addEventListeners();

            // Initialize API adapters
            helpers.toggleSpinner(true);
            try {
                await metaAdapter.init();
                const wasLinkedInCallback = await linkedinAdapter.init();

                this.state.isMetaLoggedIn = !!metaAdapter.accessToken;
                this.state.isLinkedInLoggedIn = !!linkedinAdapter.accessToken;

                this.updateLoginUI();

                // If it was a LinkedIn callback, automatically fetch data
                if (wasLinkedInCallback) {
                   await this.fetchAndRenderData();
                }

            } catch (error) {
                helpers.showToast('Initialization failed.', 'error');
                helpers.log(`Initialization error: ${error.message}`, 'ERROR');
            } finally {
                helpers.toggleSpinner(false);
            }
        },

        // --- Event Listeners ---
        addEventListeners() {
            this.elements.metaLoginBtn.addEventListener('click', () => this.handleLogin('meta'));
            this.elements.linkedinLoginBtn.addEventListener('click', () => this.handleLogin('linkedin'));
            this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
            this.elements.applyFiltersBtn.addEventListener('click', () => this.fetchAndRenderData());
            this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
        },

        // --- Authentication ---
        async handleLogin(platform) {
            helpers.toggleSpinner(true);
            try {
                if (platform === 'meta') {
                    await metaAdapter.login();
                    this.state.isMetaLoggedIn = true;
                } else if (platform === 'linkedin') {
                    await linkedinAdapter.login(); // This will redirect
                    return; // Stop execution since we are redirecting
                }
                this.updateLoginUI();
                await this.fetchAndRenderData();
            } catch (error) {
                helpers.showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} login failed.`, 'error');
                helpers.log(`Login error for ${platform}: ${error}`, 'ERROR');
            } finally {
                helpers.toggleSpinner(false);
            }
        },

        handleLogout() {
            if(this.state.isMetaLoggedIn) metaAdapter.logout();
            if(this.state.isLinkedInLoggedIn) linkedinAdapter.logout();

            this.state.isMetaLoggedIn = false;
            this.state.isLinkedInLoggedIn = false;
            this.state.dashboardData = null;

            this.updateLoginUI();
            this.clearDashboard();
            helpers.showToast('Successfully logged out.', 'success');
        },

        updateLoginUI() {
            const isLoggedIn = this.state.isMetaLoggedIn || this.state.isLinkedInLoggedIn;

            if (isLoggedIn) {
                this.elements.metaLoginBtn.style.display = 'none';
                this.elements.linkedinLoginBtn.style.display = 'none';
                this.elements.userProfile.style.display = 'flex';
                // A real app would fetch user profile info
                this.elements.userName.textContent = this.state.isMetaLoggedIn ? 'Meta User' : 'LinkedIn User';
                this.elements.userAvatar.src = 'https://via.placeholder.com/40';

                this.elements.loginPrompt.style.display = 'none';
                this.elements.dashboardArea.style.display = 'block';
            } else {
                this.elements.metaLoginBtn.style.display = 'inline-flex';
                this.elements.linkedinLoginBtn.style.display = 'inline-flex';
                this.elements.userProfile.style.display = 'none';

                this.elements.loginPrompt.style.display = 'block';
                this.elements.dashboardArea.style.display = 'none';
            }
        },

        // --- Data Fetching & Rendering ---
        async fetchAndRenderData() {
            helpers.toggleSpinner(true);
            this.clearDashboard();

            const platform = this.elements.platformSelect.value;
            this.state.activePlatform = platform;

            // For simplicity, we'll use month/year. A real app would use the date picker.
            const year = this.elements.yearSelect.value;
            const month = this.elements.monthSelect.value;
            const startDate = new Date(year, month === 'all' ? 0 : month - 1, 1);
            const endDate = new Date(year, month === 'all' ? 11 : month, 0);

            try {
                let metaData = null;
                let linkedinData = null;

                if ((platform === 'all' || platform === 'meta') && this.state.isMetaLoggedIn) {
                    metaData = await metaAdapter.fetchInsights(startDate, endDate);
                }
                if ((platform === 'all' || platform === 'linkedin') && this.state.isLinkedInLoggedIn) {
                    linkedinData = await linkedinAdapter.fetchInsights(startDate, endDate);
                }

                if (!metaData && !linkedinData) {
                    helpers.showToast('No data available for the selected criteria.', 'error');
                    helpers.log('No data fetched from any platform.', 'WARN');
                    return;
                }

                this.state.dashboardData = this.combineData(metaData, linkedinData);
                this.renderDashboard();

            } catch (error) {
                helpers.showToast('An error occurred while fetching data.', 'error');
                helpers.log(`Data fetch error: ${error.message}`, 'ERROR');
            } finally {
                helpers.toggleSpinner(false);
            }
        },

        combineData(metaData, linkedinData) {
            const combined = {
                kpis: { reach: 0, engagements: 0, followers: 0, videoViews: 0 },
                growth: [],
                topPosts: []
            };

            [metaData, linkedinData].forEach(data => {
                if (!data) return;
                combined.kpis.reach += data.kpis.reach || 0;
                combined.kpis.engagements += data.kpis.engagements || 0;
                combined.kpis.followers += data.kpis.followers || 0;
                combined.kpis.videoViews += data.kpis.videoViews || 0;
                combined.growth.push(...(data.growth || []));
                combined.topPosts.push(...(data.topPosts || []));
            });

            // Sort combined posts by engagement
            combined.topPosts.sort((a, b) => (b.stats.engagement || 0) - (a.stats.engagement || 0));

            return combined;
        },

        renderDashboard() {
            if (!this.state.dashboardData) return;

            this.renderKPIs();
            this.renderCharts();
            this.renderTopPosts();
        },

        clearDashboard() {
            this.elements.kpiReach.textContent = '—';
            this.elements.kpiEngagements.textContent = '—';
            this.elements.kpiFollowers.textContent = '—';
            this.elements.kpiVideoViews.textContent = '—';
            this.elements.topPostsContainer.innerHTML = '<p>No data to display. Apply filters to fetch data.</p>';
            if (this.state.charts.growth) this.state.charts.growth.destroy();
            if (this.state.charts.performance) this.state.charts.performance.destroy();
        },

        renderKPIs() {
            const { kpis } = this.state.dashboardData;
            this.elements.kpiReach.textContent = helpers.formatNumber(kpis.reach);
            this.elements.kpiEngagements.textContent = helpers.formatNumber(kpis.engagements);
            this.elements.kpiFollowers.textContent = helpers.formatNumber(kpis.followers);
            this.elements.kpiVideoViews.textContent = helpers.formatNumber(kpis.videoViews);
        },

        renderCharts() {
            this.renderGrowthChart();
            this.renderPerformanceChart();
        },

        renderGrowthChart() {
            if (this.state.charts.growth) this.state.charts.growth.destroy();

            const growthData = this.state.dashboardData.growth;
            const datasets = {};

            growthData.forEach(point => {
                const platform = point.platform || 'unknown';
                if (!datasets[platform]) {
                    datasets[platform] = {
                        label: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Followers`,
                        data: [],
                        borderColor: platform === 'facebook' ? '#1877F2' : '#0A66C2',
                        tension: 0.3,
                        fill: false
                    };
                }
                datasets[platform].data.push({ x: new Date(point.date).valueOf(), y: point.value });
            });

            this.state.charts.growth = new Chart(this.elements.growthChartCanvas, {
                type: 'line',
                data: { datasets: Object.values(datasets) },
                options: {
                    responsive: true,
                    scales: {
                        x: { type: 'time', time: { unit: 'day' } },
                        y: { beginAtZero: true }
                    },
                    plugins: { tooltip: { mode: 'index', intersect: false } }
                }
            });
        },

        renderPerformanceChart() {
            if (this.state.charts.performance) this.state.charts.performance.destroy();

            const topPosts = this.state.dashboardData.topPosts.slice(0, 10); // Top 10 posts
            const labels = topPosts.map(p => helpers.trimText(p.caption, 20) || `Post ${p.id.slice(-4)}`);
            const engagementData = topPosts.map(p => p.stats.engagement);

            this.state.charts.performance = new Chart(this.elements.performanceChartCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Engagement',
                        data: engagementData,
                        backgroundColor: 'rgba(0, 74, 141, 0.7)',
                        borderColor: 'rgba(0, 74, 141, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    scales: { x: { beginAtZero: true } },
                    plugins: { legend: { display: false } }
                }
            });
        },

        renderTopPosts() {
            const posts = this.state.dashboardData.topPosts;
            const container = this.elements.topPostsContainer;

            if (posts.length === 0) {
                container.innerHTML = '<p>No posts found for the selected criteria.</p>';
                return;
            }

            container.innerHTML = ''; // Clear previous posts
            posts.slice(0, 12).forEach(post => { // Show max 12 posts
                const postCard = document.createElement('a');
                postCard.className = 'post-card';
                postCard.href = post.url;
                postCard.target = '_blank';
                postCard.rel = 'noopener noreferrer';

                const platformIcon = post.platform === 'instagram' ? 'fa-instagram' : 'fa-linkedin';

                postCard.innerHTML = `
                    <div class="post-thumbnail">
                        <img src="${post.thumbnail}" alt="Post thumbnail" onerror="this.src='https://via.placeholder.com/300x200';">
                    </div>
                    <div class="post-content">
                        <p>${helpers.trimText(post.caption, 120)}</p>
                    </div>
                    <div class="post-stats">
                        <div class="stat"><i class="fas fa-heart"></i> <span>${helpers.formatNumber(post.stats.likes)}</span></div>
                        <div class="stat"><i class="fas fa-comment"></i> <span>${helpers.formatNumber(post.stats.comments)}</span></div>
                        <div class="stat"><i class="fas fa-bookmark"></i> <span>${helpers.formatNumber(post.stats.saves)}</span></div>
                        <div class="stat"><i class="fas fa-bullseye"></i> <span>${helpers.formatNumber(post.stats.reach)}</span></div>
                        <div class="stat"><i class="fab ${platformIcon}"></i></div>
                    </div>
                `;
                container.appendChild(postCard);
            });
        },

        // --- Export ---
        exportData() {
            if (!this.state.dashboardData) {
                helpers.showToast('No data to export.', 'error');
                return;
            }

            const platform = this.state.activePlatform;
            const date = new Date().toISOString().split('T')[0];
            const filename = `dashboard-export-${platform}-${date}`;

            // For simplicity, we'll offer JSON export of all data, and CSV of top posts.
            // A more advanced version could ask the user.
            helpers.exportData(this.state.dashboardData, filename, 'csv');
            helpers.exportData(this.state.dashboardData, filename, 'json');

            helpers.showToast('Data export started.', 'success');
        }
    };

    // --- Run Application ---
    app.init();
});
