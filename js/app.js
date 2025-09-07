// FILE: js/app.js

/**
 * Main application logic for the Social Media Dashboard.
 * Refactored to use a single aggregator API.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- DOM Elements ---
        elements: {
            // New API Key UI
            apiKeyInput: document.getElementById('api-key-input'),
            fetchDataBtn: document.getElementById('fetch-data-btn'),

            // Areas
            initialPrompt: document.getElementById('initial-prompt'),
            dashboardArea: document.getElementById('dashboard-area'),

            // Filters
            platformSelect: document.getElementById('platform-select'),
            monthSelect: document.getElementById('month-select'),
            yearSelect: document.getElementById('year-select'),
            dateRangePicker: document.getElementById('date-range-picker'),
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
        },

        // --- State ---
        state: {
            apiKey: null,
            dashboardData: null,
            charts: {
                growth: null,
                performance: null,
            }
        },

        // --- Initialization ---
        init() {
            helpers.log('Dashboard initializing...');
            helpers.setFooterYear();
            helpers.populateDateFilters();
            this.addEventListeners();

            // Persist API key from local storage if available
            const savedApiKey = localStorage.getItem('dashboard_api_key');
            if(savedApiKey) {
                this.elements.apiKeyInput.value = savedApiKey;
                this.state.apiKey = savedApiKey;
                helpers.log('Loaded API key from local storage.');
            }
        },

        // --- Event Listeners ---
        addEventListeners() {
            this.elements.fetchDataBtn.addEventListener('click', () => this.fetchAndRenderData());
            this.elements.applyFiltersBtn.addEventListener('click', () => this.fetchAndRenderData());
            this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
        },

        // --- Data Fetching & Rendering ---
        async fetchAndRenderData() {
            const apiKey = this.elements.apiKeyInput.value.trim();
            if (!apiKey) {
                helpers.showToast('Please enter your API key.', 'error');
                return;
            }

            // Save API key for convenience
            this.state.apiKey = apiKey;
            localStorage.setItem('dashboard_api_key', apiKey);

            helpers.toggleSpinner(true);
            this.clearDashboard(false); // Clear previous data but not the prompt

            // Get date range from filters
            const year = this.elements.yearSelect.value;
            const month = this.elements.monthSelect.value;
            const startDate = new Date(year, month === 'all' ? 0 : month - 1, 1);
            const endDate = new Date(year, month === 'all' ? 11 : month, 0);

            try {
                // Call the new single adapter
                const data = await aggregatorAdapter.fetchInsights(this.state.apiKey, startDate, endDate);

                if (!data) {
                    helpers.showToast('No data returned from the API.', 'error');
                    helpers.log('No data fetched from aggregator.', 'WARN');
                    return;
                }

                this.state.dashboardData = data;
                this.elements.initialPrompt.style.display = 'none'; // Hide prompt on successful fetch
                this.renderDashboard();

            } catch (error) {
                helpers.showToast('An error occurred while fetching data.', 'error');
                helpers.log(`Data fetch error: ${error.message}`, 'ERROR');
            } finally {
                helpers.toggleSpinner(false);
            }
        },

        renderDashboard() {
            if (!this.state.dashboardData) return;
            this.renderKPIs();
            this.renderCharts();
            this.renderTopPosts();
        },

        clearDashboard(clearPrompt = true) {
            this.elements.kpiReach.textContent = '—';
            this.elements.kpiEngagements.textContent = '—';
            this.elements.kpiFollowers.textContent = '—';
            this.elements.kpiVideoViews.textContent = '—';
            this.elements.topPostsContainer.innerHTML = '';
            if (this.state.charts.growth) this.state.charts.growth.destroy();
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            if (clearPrompt) {
                 this.elements.initialPrompt.style.display = 'block';
            }
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
            // This chart may not be feasible if the aggregator doesn't provide daily growth data.
            // We'll leave the logic here as a template.
            if (this.state.charts.growth) this.state.charts.growth.destroy();
            // Placeholder: A real implementation depends on aggregator providing timeseries data.
        },

        renderPerformanceChart() {
            if (this.state.charts.performance) this.state.charts.performance.destroy();

            const topPosts = this.state.dashboardData.topPosts.slice(0, 10);
            const labels = topPosts.map(p => helpers.trimText(p.caption, 20) || `Post ${p.id.slice(-4)}`);
            const engagementData = topPosts.map(p => p.stats.engagement);

            this.state.charts.performance = new Chart(this.elements.performanceChartCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Engagement',
                        data: engagementData,
                        backgroundColor: 'rgba(10, 34, 74, 0.8)',
                        borderColor: 'rgba(10, 34, 74, 1)',
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } } }
            });
        },

        renderTopPosts() {
            const posts = this.state.dashboardData.topPosts;
            const container = this.elements.topPostsContainer;

            if (posts.length === 0) {
                container.innerHTML = '<p>No posts found for the selected criteria.</p>';
                return;
            }

            container.innerHTML = '';
            posts.slice(0, 12).forEach(post => {
                const postCard = document.createElement('a');
                postCard.className = 'post-card';
                postCard.href = post.url;
                postCard.target = '_blank';
                postCard.rel = 'noopener noreferrer';

                const platformIcon = `fa-${post.platform}`;

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

        exportData() {
            if (!this.state.dashboardData) {
                helpers.showToast('No data to export.', 'error');
                return;
            }
            const date = new Date().toISOString().split('T')[0];
            const filename = `dashboard-export-${date}`;
            helpers.exportData(this.state.dashboardData, filename, 'csv');
            helpers.exportData(this.state.dashboardData, filename, 'json');
            helpers.showToast('Data export started.', 'success');
        }
    };

    // --- Run Application ---
    app.init();
});
