// FILE: js/adapters/aggregator.js

/**
 * API Adapter specifically for the Ayrshare Social Media API.
 * Updated to be resilient and work within Free Plan limitations.
 */
const aggregatorAdapter = {
    apiBaseUrl: 'https://app.ayrshare.com/api',

    /**
     * Fetches post history from the Ayrshare API.
     * @param {string} apiKey The user's API key for Ayrshare.
     * @returns {Promise<object|null>} A promise that resolves with the formatted insights data.
     */
    async fetchInsights(apiKey) {
        if (!apiKey) {
            helpers.showToast('API Key is missing.', 'error');
            return null;
        }

        helpers.log('Fetching post history from Ayrshare...');

        try {
            // Only call the /history endpoint
            const historyData = await this.fetchHistory(apiKey);

            // The formatData function will handle null/empty data
            const formattedData = this.formatData(historyData);
            helpers.log('Successfully processed data from Ayrshare.');
            return formattedData;

        } catch (error) {
            // This catch is for network errors, not API errors handled in fetchHistory
            helpers.showToast('A network error occurred.', 'error');
            helpers.log(`Network Error: ${error.message}`, 'ERROR');
            return null;
        }
    },

    /**
     * Fetches the /history endpoint and handles API errors gracefully.
     * @param {string} apiKey The user's API key.
     * @returns {Promise<object|null>} The JSON response from the API or null if it fails.
     */
    async fetchHistory(apiKey) {
        const response = await fetch(`${this.apiBaseUrl}/history`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            // Handle 400 Bad Request (likely no history) and other errors gracefully
            helpers.log(`API returned status ${response.status}. This can happen if there are no posts yet.`, 'WARN');
            return null; // Return null instead of throwing an error
        }
        return response.json();
    },

    /**
     * Formats the raw API data from Ayrshare's /history endpoint.
     * @param {object | null} historyData The response from the /history endpoint.
     * @returns {object} A standardized data object for the dashboard.
     */
    formatData(historyData) {
        const posts = historyData ? (Array.isArray(historyData) ? historyData : (historyData.history || [])) : [];

        const formatted = {
            kpis: { reach: 0, engagements: 0, followers: 'N/A', videoViews: 0 },
            topPosts: []
        };

        if (posts.length === 0) {
            helpers.log("No post history found.", "INFO");
        }

        posts.forEach(post => {
            const postEngagements = (post.stats?.likes || 0) + (post.stats?.comments || 0) + (post.stats?.shares || 0);
            formatted.kpis.engagements += postEngagements;

            formatted.topPosts.push({
                platform: post.platform.toLowerCase(),
                id: post.id,
                thumbnail: post.mediaUrls?.[0] || 'https://via.placeholder.com/300x200',
                caption: post.post,
                url: post.postUrl,
                stats: {
                    likes: post.stats?.likes || 0,
                    comments: post.stats?.comments || 0,
                    saves: 'N/A',
                    reach: 'N/A',
                    engagement: postEngagements
                },
                timestamp: post.timestamp || post.created_at
            });
        });

        helpers.log("Followers, Reach, and Video Views KPIs are not available on this API plan.", "WARN");

        formatted.topPosts.sort((a, b) => b.stats.engagement - a.stats.engagement);

        return formatted;
    }
};
