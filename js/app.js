// FILE: js/app.js

/**
 * Main application logic for the Social Media Dashboard.
 * Final, correct version with two-step /history -> /analytics/post data flow.
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
            kpiReach: document.getElementById('kpi-reach'),
            kpiEngagements: document.getElementById('kpi-engagements'),
            kpiVideoViews: document.getElementById('kpi-video-views'),
            performanceChartCanvas: document.getElementById('performance-chart'),
            topPostsContainer: document.getElementById('top-posts-container'),
            apiKeyModal: document.getElementById('api-key-modal'),
            modalApiKeyInput: document.getElementById('modal-api-key-input'),
            saveApiKeyBtn: document.getElementById('save-api-key-btn'),
            createPostBtn: document.getElementById('create-post-btn'),
            createPostModal: document.getElementById('create-post-modal'),
            postContentTextarea: document.getElementById('post-content-textarea'),
            sendPostBtn: document.getElementById('send-post-btn'),
            platformCheckboxes: document.querySelectorAll('input[name="platforms"]'),
            closeModalBtns: document.querySelectorAll('.close-modal-btn'),
        },

        // --- State ---
        state: {
            apiKey: null,
            allPostsWithAnalytics: [], // This will be the source of truth, fetched from the API.
            dashboardData: null,
            charts: { performance: null },
        },

        // --- Initialization ---
        init() {
            helpers.log('Dashboard initializing...');
            helpers.setFooterYear();
            helpers.populateDateFilters();
            this.addEventListeners();
            this.state.apiKey = localStorage.getItem('dashboard_api_key');
            if (!this.state.apiKey) {
                this.showApiKeyModal();
            } else {
                this.loadAndFetchAllData();
            }
        },

        // --- Event Listeners ---
        addEventListeners() {
            this.elements.applyFiltersBtn.addEventListener('click', () => this.applyFiltersAndRender());
            this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
            this.elements.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
            this.elements.createPostBtn.addEventListener('click', () => this.showCreatePostModal());
            this.elements.sendPostBtn.addEventListener('click', () => this.handleSendPost());
            this.elements.closeModalBtns.forEach(btn => {
                const modalId = btn.getAttribute('data-modal-id');
                btn.addEventListener('click', () => {
                    if (modalId === 'api-key-modal') this.hideApiKeyModal();
                    if (modalId === 'create-post-modal') this.hideCreatePostModal();
                });
            });
        },

        // --- Modals and UI Management ---
        showApiKeyModal() { this.elements.apiKeyModal.style.display = 'flex'; },
        hideApiKeyModal() { this.elements.apiKeyModal.style.display = 'none'; },
        showCreatePostModal() { this.elements.createPostModal.style.display = 'flex'; },
        hideCreatePostModal() { this.elements.createPostModal.style.display = 'none'; },

        handleSaveApiKey() {
            const apiKey = this.elements.modalApiKeyInput.value.trim();
            if (!apiKey) { helpers.showToast('Please enter a valid API key.', 'error'); return; }
            this.state.apiKey = apiKey;
            localStorage.setItem('dashboard_api_key', apiKey);
            helpers.showToast('API Key saved successfully!', 'success');
            this.hideApiKeyModal();
            this.loadAndFetchAllData();
        },

        async handleSendPost() {
            const postContent = this.elements.postContentTextarea.value.trim();
            if (!postContent) { helpers.showToast('Post content cannot be empty.', 'error'); return; }
            const platforms = Array.from(this.elements.platformCheckboxes)
                .filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
            if (platforms.length === 0) { helpers.showToast('Please select at least one platform.', 'error'); return; }

            helpers.toggleSpinner(true);
            try {
                await aggregatorAdapter.createPost({ apiKey: this.state.apiKey, post: postContent, platforms });
                helpers.showToast('Post sent! Refreshing dashboard...', 'success');
                this.elements.postContentTextarea.value = '';
                this.hideCreatePostModal();
                setTimeout(() => this.loadAndFetchAllData(), 3000); // Wait 3s for API to process post before fetching
            } catch (error) {
                helpers.showToast(`Failed to send post: ${error.message}`, 'error');
            } finally {
                helpers.toggleSpinner(false);
            }
        },

        // --- Data Handling & Aggregation ---
        async loadAndFetchAllData() {
            if (!this.state.apiKey) { this.showApiKeyModal(); return; }

            helpers.toggleSpinner(true);
            this.clearDashboard();
            this.elements.refreshStatus.innerHTML = `<i class="fas fa-sync-alt"></i> <span>Fetching post history...</span>`;

            const history = await aggregatorAdapter.fetchHistory(this.state.apiKey);

            if (history.length === 0) {
                helpers.log('No post history found to analyze.');
                this.elements.initialPrompt.style.display = 'block';
                this.elements.refreshStatus.innerHTML = `<i class="fas fa-info-circle"></i> <span>No posts found. Create one to begin!</span>`;
                helpers.toggleSpinner(false);
                return;
            }

            this.elements.refreshStatus.innerHTML = `<i class="fas fa-sync-alt"></i> <span>Fetching analytics for ${history.length} posts...</span>`;

            const analyticsPromises = history.map(post =>
                aggregatorAdapter.fetchPostAnalytics({ apiKey: this.state.apiKey, id: post.id })
            );

            const results = await Promise.all(analyticsPromises);
            this.state.allPostsWithAnalytics = results.filter(r => r);

            helpers.toggleSpinner(false);
            this.elements.initialPrompt.style.display = 'none';
            this.elements.refreshStatus.innerHTML = `<i class="fas fa-check-circle"></i> <span>Data loaded. Displaying ${this.state.allPostsWithAnalytics.length} posts.</span>`;
            this.applyFiltersAndRender();
        },

        applyFiltersAndRender() {
            if (!this.state.allPostsWithAnalytics) return;

            const selectedPlatform = this.elements.platformSelect.value;
            const selectedYear = parseInt(this.elements.yearSelect.value, 10);
            const selectedMonth = this.elements.monthSelect.value;

            const filteredPosts = this.state.allPostsWithAnalytics.filter(post => {
                const postPlatform = Object.keys(post).find(key => ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'reddit', 'threads', 'bluesky', 'snapchat', 'gmb'].includes(key));
                if (!postPlatform) return false;
                const postDate = new Date(post[postPlatform]?.analytics?.created || post[postPlatform]?.created || Date.now());

                const platformMatch = selectedPlatform === 'all' || postPlatform === selectedPlatform;
                const yearMatch = postDate.getFullYear() === selectedYear;
                const monthMatch = selectedMonth === 'all' || (postDate.getMonth() + 1) == selectedMonth;
                return platformMatch && yearMatch && monthMatch;
            });

            const aggregatedData = this.aggregateDataFromPosts(filteredPosts);
            this.state.dashboardData = aggregatedData;
            this.renderDashboard(aggregatedData);
        },

        aggregateDataFromPosts(posts) {
            const aggregated = { kpis: { reach: 0, engagements: 0, videoViews: 0 }, topPosts: [] };
            posts.forEach(post => {
                const platformKey = Object.keys(post).find(key => ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'reddit', 'threads', 'bluesky', 'snapchat', 'gmb'].includes(key));
                if (!platformKey) return;

                const analytics = post[platformKey].analytics || {};
                const engagement = analytics.engagementCount || (analytics.likeCount || 0) + (analytics.commentsCount || 0) + (analytics.sharesCount || 0) + (analytics.repostCount || 0) + (analytics.retweetCount || 0);
                const reach = analytics.reachCount || analytics.impressions || analytics.impressionCount || 0;
                const videoViews = analytics.playsCount || analytics.videoViews || analytics.views || 0;

                aggregated.kpis.engagements += engagement;
                aggregated.kpis.reach += reach;
                aggregated.kpis.videoViews += videoViews;

                aggregated.topPosts.push({
                    platform: platformKey,
                    id: post.id,
                    thumbnail: analytics.mediaUrls?.[0]?.mediaUrl || post[platformKey]?.thumbnailUrl || 'https://via.placeholder.com/300x200',
                    caption: analytics.caption || post[platformKey].post || 'No caption available.',
                    url: post[platformKey].postUrl,
                    stats: {
                        likes: analytics.likeCount || 0,
                        comments: analytics.commentsCount || 0,
                        saves: analytics.savedCount || 'N/A',
                        reach: reach,
                        videoViews: videoViews,
                        engagement: engagement
                    },
                    timestamp: analytics.created || post[platformKey].created
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
            this.elements.kpiReach.textContent = '—';
            this.elements.kpiEngagements.textContent = '—';
            this.elements.kpiVideoViews.textContent = '—';
            this.elements.topPostsContainer.innerHTML = '';
            if (this.state.charts.performance) this.state.charts.performance.destroy();
            this.elements.initialPrompt.style.display = 'block';
        },

        renderKPIs(kpis) {
            this.elements.kpiReach.textContent = helpers.formatNumber(kpis.reach);
            this.elements.kpiEngagements.textContent = helpers.formatNumber(kpis.engagements);
            this.elements.kpiVideoViews.textContent = helpers.formatNumber(kpis.videoViews);
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
