// FILE: js/app.js

/**
 * Main application logic for the Social Media Dashboard.
 * This version is adapted to use data from a Google Sheet.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- DOM Elements ---
        elements: {
            refreshStatus: document.getElementById('refresh-status'),
            initialPrompt: document.getElementById('initial-prompt'),
            platformSelect: document.getElementById('platform-select'),
            monthSelect: document.getElementById('month-select'),
            yearSelect: document.getElementById('year-select'),
            applyFiltersBtn: document.getElementById('apply-filters-btn'),
            exportDataBtn: document.getElementById('export-data-btn'),
            kpiSection: document.getElementById('kpi-section'),
            performanceChartCanvas: document.getElementById('performance-chart'),
            topPostsContainer: document.getElementById('top-posts-container'),
        },

        // --- State ---
        state: {
            allPosts: [],
            dashboardData: null,
            charts: { performance: null },
        },

        // --- Initialization ---
        init() {
            helpers.log('Dashboard initializing...');
            helpers.setFooterYear();
            helpers.populateDateFilters();
            this.addEventListeners();
            this.loadAndFetchAllData();
        },

        // --- Event Listeners ---
        addEventListeners() {
            this.elements.applyFiltersBtn.addEventListener('click', () => this.applyFiltersAndRender());
            this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
        },

        // --- Data Handling & Aggregation ---
        async loadAndFetchAllData() {
            helpers.toggleSpinner(true);
            this.clearDashboard();
            this.elements.refreshStatus.innerHTML = `<i class="fas fa-sync-alt"></i> <span>Fetching data from Google Sheet...</span>`;

            try {
                const history = await googleSheetAdapter.fetchData();

                if (history.length === 0) {
                    helpers.log('No post history found in Google Sheet.');
                    this.elements.initialPrompt.style.display = 'block';
                    this.elements.refreshStatus.innerHTML = `<i class="fas fa-info-circle"></i> <span>No posts found in the data source.</span>`;
                    helpers.toggleSpinner(false);
                    return;
                }

                this.state.allPosts = history;

                helpers.toggleSpinner(false);
                this.elements.initialPrompt.style.display = 'none';
                this.elements.refreshStatus.innerHTML = `<i class="fas fa-check-circle"></i> <span>Data loaded. Displaying ${this.state.allPosts.length} posts.</span>`;
                this.applyFiltersAndRender();

            } catch(error) {
                helpers.toggleSpinner(false);
                this.elements.refreshStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>Error loading data.</span>`;
                helpers.showToast(error.message, 'error');
            }
        },

        applyFiltersAndRender() {
            if (!this.state.allPosts) return;

            const selectedPlatform = this.elements.platformSelect.value;
            const selectedYear = parseInt(this.elements.yearSelect.value, 10);
            const selectedMonth = this.elements.monthSelect.value;

            const filteredPosts = this.state.allPosts.filter(post => {
                const postDate = new Date(post.Date);
                const platformMatch = selectedPlatform === 'all' || post['Traffic source']?.toLowerCase() === selectedPlatform;
                const yearMatch = postDate.getFullYear() === selectedYear;
                const monthMatch = selectedMonth === 'all' || (postDate.getMonth() + 1) == selectedMonth;
                return platformMatch && yearMatch && monthMatch;
            });

            const aggregatedData = this.aggregateDataFromPosts(filteredPosts);
            this.state.dashboardData = aggregatedData;
            this.renderDashboard(aggregatedData);
        },

        aggregateDataFromPosts(posts) {
            const aggregated = {
                kpis: {
                    facebook: { reach: 0, engagements: 0, videoViews: 0 },
                    instagram: { reach: 0, engagements: 0, videoViews: 0 },
                    linkedin: { reach: 0, engagements: 0, videoViews: 0 },
                    total: { reach: 0, engagements: 0, videoViews: 0 }
                },
                topPosts: []
            };

            posts.forEach(post => {
                const platform = post['Traffic source']?.toLowerCase();
                if (!platform) return;

                const reach = parseInt(post['Post Total Reach - Lifetime, Post'], 10) || 0;
                const engagements = parseInt(post['Total Post Clicks (Lifetime)'], 10) || 0;
                const videoViews = parseInt(post['Total Video Views (Lifetime)'], 10) || 0;

                if (aggregated.kpis[platform]) {
                    aggregated.kpis[platform].reach += reach;
                    aggregated.kpis[platform].engagements += engagements;
                    aggregated.kpis[platform].videoViews += videoViews;
                }

                aggregated.kpis.total.reach += reach;
                aggregated.kpis.total.engagements += engagements;
                aggregated.kpis.total.videoViews += videoViews;

                aggregated.topPosts.push({
                    platform: platform,
                    id: post['Post ID'],
                    thumbnail: post['Full Picture URL'] || 'https://via.placeholder.com/300x200',
                    caption: post['Post Message'] || 'No caption available.',
                    url: post['Post Permalink URL'],
                    stats: {
                        likes: parseInt(post['Post Likes'], 10) || 0,
                        comments: parseInt(post['Post Comments'], 10) || 0,
                        saves: 'N/A',
                        reach: reach,
                        videoViews: videoViews,
                        engagement: engagements
                    },
                    timestamp: new Date(post.Date).getTime()
                });
            });
            return aggregated;
        },

        renderDashboard(data) {
            this.renderKPIs(data.kpis);
            this.renderPerformanceChart(data.topPosts);
            this.renderTopPosts(data.topPosts);
        },

        clearDashboard() {
            this.elements.kpiSection.innerHTML = '';
            this.elements.topPostsContainer.innerHTML = '';
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            this.elements.initialPrompt.style.display = 'block';
        },

        renderKPIs(kpis) {
            const kpiSection = this.elements.kpiSection;
            kpiSection.innerHTML = ''; // Clear previous KPIs

            const platforms = ['facebook', 'instagram', 'linkedin'];
            const icons = {
                facebook: 'fa-facebook',
                instagram: 'fa-instagram',
                linkedin: 'fa-linkedin'
            }

            let kpiHTML = '<h2>Total KPIs</h2><div class="kpi-grid">';
            kpiHTML += `
                <div class="card kpi-card">
                    <h3><i class="fas fa-bullseye"></i> Total Reach</h3>
                    <p>${helpers.formatNumber(kpis.total.reach)}</p>
                </div>
                <div class="card kpi-card">
                    <h3><i class="fas fa-heart"></i> Total Engagements</h3>
                    <p>${helpers.formatNumber(kpis.total.engagements)}</p>
                </div>
                <div class="card kpi-card">
                    <h3><i class="fas fa-video"></i> Total Video Views</h3>
                    <p>${helpers.formatNumber(kpis.total.videoViews)}</p>
                </div>
            </div>`;


            platforms.forEach(platform => {
                const platformKpis = kpis[platform];
                if (platformKpis) {
                    kpiHTML += `<h2><i class="fab ${icons[platform]}"></i> ${platform.charAt(0).toUpperCase() + platform.slice(1)} KPIs</h2><div class="kpi-grid">`;
                    kpiHTML += `
                        <div class="card kpi-card">
                            <h3><i class="fas fa-bullseye"></i> Reach</h3>
                            <p>${helpers.formatNumber(platformKpis.reach)}</p>
                        </div>
                        <div class="card kpi-card">
                            <h3><i class="fas fa-heart"></i> Engagements</h3>
                            <p>${helpers.formatNumber(platformKpis.engagements)}</p>
                        </div>
                        <div class="card kpi-card">
                            <h3><i class="fas fa-video"></i> Video Views</h3>
                            <p>${helpers.formatNumber(platformKpis.videoViews)}</p>
                        </div>
                    `;
                    kpiHTML += '</div>';
                }
            });

            kpiSection.innerHTML = kpiHTML;
        },

        renderPerformanceChart(posts) {
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            const topPosts = [...posts].sort((a,b) => b.stats.engagement - a.stats.engagement).slice(0, 10);
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
            if (posts.length === 0) { container.innerHTML = '<p>No posts match the current filters. Try selecting "All Platforms".</p>'; return; }
            container.innerHTML = '';
            [...posts].sort((a,b) => b.stats.engagement - a.stats.engagement).slice(0, 12).forEach(post => {
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
            if (!this.state.dashboardData) { helpers.showToast('No data available to export.', 'error'); return; }
            const date = new Date().toISOString().split('T')[0];
            const filename = `dashboard-export-${date}`;
            helpers.exportData(this.state.dashboardData, filename, 'csv');
            helpers.exportData(this.state.dashboardData, filename, 'json');
            helpers.showToast('Data export started.', 'success');
        }
    };

    app.init();
});
