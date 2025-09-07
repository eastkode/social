// FILE: js/app.js

/**
 * Main application logic for the Social Media Dashboard.
 * Final version with automated refresh and user-friendly API key modal.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- Constants ---
        REFRESH_INTERVAL_MS: 3 * 24 * 60 * 60 * 1000, // 3 days

        // --- DOM Elements ---
        elements: {
            refreshStatus: document.getElementById('refresh-status'),
            initialPrompt: document.getElementById('initial-prompt'),
            platformSelect: document.getElementById('platform-select'),
            monthSelect: document.getElementById('month-select'),
            yearSelect: document.getElementById('year-select'),
            applyFiltersBtn: document.getElementById('apply-filters-btn'),
            exportDataBtn: document.getElementById('export-data-btn'),
            kpiReach: document.getElementById('kpi-reach'),
            kpiEngagements: document.getElementById('kpi-engagements'),
            kpiFollowers: document.getElementById('kpi-followers'),
            kpiVideoViews: document.getElementById('kpi-video-views'),
            performanceChartCanvas: document.getElementById('performance-chart'),
            topPostsContainer: document.getElementById('top-posts-container'),
            // Modal Elements
            apiKeyModal: document.getElementById('api-key-modal'),
            modalApiKeyInput: document.getElementById('modal-api-key-input'),
            saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        },

        // --- State ---
        state: {
            apiKey: null,
            allData: null,
            charts: { performance: null },
            timerInterval: null,
        },

        // --- Initialization ---
        init() {
            helpers.log('Dashboard initializing...');
            helpers.setFooterYear();
            helpers.populateDateFilters();
            this.addEventListeners();

            this.state.apiKey = localStorage.getItem('dashboard_api_key');

            if (!this.state.apiKey) {
                helpers.log('API Key not found. Prompting user.');
                this.showApiKeyModal();
            } else {
                this.loadInitialData();
            }
        },

        // --- Event Listeners ---
        addEventListeners() {
            this.elements.applyFiltersBtn.addEventListener('click', () => this.applyFiltersAndRender());
            this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
            this.elements.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
        },

        // --- API Key Management ---
        showApiKeyModal() {
            this.elements.apiKeyModal.style.display = 'flex';
        },

        hideApiKeyModal() {
            this.elements.apiKeyModal.style.display = 'none';
        },

        handleSaveApiKey() {
            const apiKey = this.elements.modalApiKeyInput.value.trim();
            if (!apiKey) {
                helpers.showToast('Please enter a valid API key.', 'error');
                return;
            }
            this.state.apiKey = apiKey;
            localStorage.setItem('dashboard_api_key', apiKey);
            helpers.showToast('API Key saved successfully!', 'success');
            this.hideApiKeyModal();
            this.loadInitialData();
        },

        // --- Data Handling ---
        loadInitialData() {
            const cachedData = localStorage.getItem('dashboard_cached_data');
            const lastFetchTimestamp = parseInt(localStorage.getItem('dashboard_last_fetch_timestamp'), 10);
            const now = Date.now();

            if (cachedData && lastFetchTimestamp && (now - lastFetchTimestamp < this.REFRESH_INTERVAL_MS)) {
                this.loadDataFromCache(cachedData, lastFetchTimestamp);
            } else {
                this.fetchAndCacheData();
            }
        },

        loadDataFromCache(cachedData, timestamp) {
            try {
                this.state.allData = JSON.parse(cachedData);
                this.elements.initialPrompt.style.display = 'none';
                this.applyFiltersAndRender();
                this.startRefreshTimer(timestamp + this.REFRESH_INTERVAL_MS);
            } catch (error) {
                this.fetchAndCacheData();
            }
        },

        async fetchAndCacheData() {
            if (!this.state.apiKey) {
                this.showApiKeyModal();
                return;
            }
            helpers.toggleSpinner(true);
            this.clearDashboard();

            try {
                const data = await aggregatorAdapter.fetchInsights(this.state.apiKey);
                if (!data) return; // Error is handled in adapter

                const now = Date.now();
                this.state.allData = data;
                localStorage.setItem('dashboard_cached_data', JSON.stringify(data));
                localStorage.setItem('dashboard_last_fetch_timestamp', now);

                this.elements.initialPrompt.style.display = 'none';
                this.applyFiltersAndRender();
                this.startRefreshTimer(now + this.REFRESH_INTERVAL_MS);

            } finally {
                helpers.toggleSpinner(false);
            }
        },

        // --- Rendering Logic (largely unchanged) ---
        applyFiltersAndRender() {
            if (!this.state.allData) return;
            const selectedPlatform = this.elements.platformSelect.value;
            const selectedYear = parseInt(this.elements.yearSelect.value, 10);
            const selectedMonth = this.elements.monthSelect.value;

            const filteredPosts = this.state.allData.topPosts.filter(post => {
                const postDate = new Date(post.timestamp);
                const platformMatch = selectedPlatform === 'all' || post.platform === selectedPlatform;
                const yearMatch = postDate.getFullYear() === selectedYear;
                const monthMatch = selectedMonth === 'all' || (postDate.getMonth() + 1) == selectedMonth;
                return platformMatch && yearMatch && monthMatch;
            });

            const filteredKPIs = {
                reach: 0, engagements: 0,
                followers: this.state.allData.kpis.followers,
                videoViews: 0,
            };
            filteredPosts.forEach(post => { filteredKPIs.engagements += post.stats.engagement || 0; });

            const filteredDashboardData = { kpis: filteredKPIs, topPosts: filteredPosts };
            this.renderDashboard(filteredDashboardData);
        },

        renderDashboard(data) {
            this.renderKPIs(data.kpis);
            this.renderPerformanceChart(data.topPosts);
            this.renderTopPosts(data.topPosts);
        },

        clearDashboard() {
            this.elements.kpiReach.textContent = '—';
            this.elements.kpiEngagements.textContent = '—';
            this.elements.kpiFollowers.textContent = '—';
            this.elements.kpiVideoViews.textContent = '—';
            this.elements.topPostsContainer.innerHTML = '';
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            this.elements.initialPrompt.style.display = 'block';
        },

        renderKPIs(kpis) {
            this.elements.kpiReach.textContent = helpers.formatNumber(kpis.reach);
            this.elements.kpiEngagements.textContent = helpers.formatNumber(kpis.engagements);
            this.elements.kpiFollowers.textContent = helpers.formatNumber(kpis.followers);
            this.elements.kpiVideoViews.textContent = helpers.formatNumber(kpis.videoViews);
        },

        renderPerformanceChart(posts) {
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            const topPosts = posts.slice(0, 10);
            const labels = topPosts.map(p => helpers.trimText(p.caption, 20) || `Post ${p.id.slice(-4)}`);
            const engagementData = topPosts.map(p => p.stats.engagement);
            this.state.charts.performance = new Chart(this.elements.performanceChartCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Engagement', data: engagementData,
                        backgroundColor: 'rgba(10, 34, 74, 0.8)', borderColor: 'rgba(10, 34, 74, 1)',
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } } }
            });
        },

        renderTopPosts(posts) {
            const container = this.elements.topPostsContainer;
            if (posts.length === 0) { container.innerHTML = '<p>No posts found for the selected criteria.</p>'; return; }
            container.innerHTML = '';
            posts.slice(0, 12).forEach(post => {
                const postCard = document.createElement('a');
                postCard.className = 'post-card';
                postCard.href = post.url;
                postCard.target = '_blank';
                postCard.rel = 'noopener noreferrer';
                const platformIcon = `fa-${post.platform}`;
                postCard.innerHTML = `
                    <div class="post-thumbnail"><img src="${post.thumbnail}" alt="Post thumbnail" onerror="this.src='https://via.placeholder.com/300x200';"></div>
                    <div class="post-content"><p>${helpers.trimText(post.caption, 120)}</p></div>
                    <div class="post-stats">
                        <div class="stat"><i class="fas fa-heart"></i> <span>${helpers.formatNumber(post.stats.likes)}</span></div>
                        <div class="stat"><i class="fas fa-comment"></i> <span>${helpers.formatNumber(post.stats.comments)}</span></div>
                        <div class="stat"><i class="fas fa-bookmark"></i> <span>${helpers.formatNumber(post.stats.saves)}</span></div>
                        <div class="stat"><i class="fas fa-bullseye"></i> <span>${helpers.formatNumber(post.stats.reach)}</span></div>
                        <div class="stat"><i class="fab ${platformIcon}"></i></div>
                    </div>`;
                container.appendChild(postCard);
            });
        },

        exportData() {
            if (!this.state.allData) { helpers.showToast('No data available to export.', 'error'); return; }
            const date = new Date().toISOString().split('T')[0];
            const filename = `dashboard-export-${date}`;
            helpers.exportData(this.state.allData, filename, 'csv');
            helpers.exportData(this.state.allData, filename, 'json');
            helpers.showToast('Data export started.', 'success');
        },

        startRefreshTimer(nextRefreshTime) {
            if (this.state.timerInterval) clearInterval(this.state.timerInterval);
            const update = () => {
                const remaining = nextRefreshTime - Date.now();
                if (remaining <= 0) {
                    this.elements.refreshStatus.innerHTML = `<i class="fas fa-sync-alt"></i> <span>Refreshing now...</span>`;
                    clearInterval(this.state.timerInterval);
                    location.reload();
                    return;
                }
                const d = Math.floor(remaining / (1000 * 60 * 60 * 24));
                const h = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const m = Math.floor((remaining / 1000 / 60) % 60);
                this.elements.refreshStatus.innerHTML = `<i class="fas fa-history"></i> <span>Next refresh in: ${d}d ${h}h ${m}m</span>`;
            };
            update();
            this.state.timerInterval = setInterval(update, 1000);
        }
    };

    app.init();
});
