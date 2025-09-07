// FILE: js/adapters/aggregator.js

/**
 * API Adapter specifically for the Ayrshare Social Media API.
 * This simplifies data fetching by using a single API key and specific endpoints.
 */
const aggregatorAdapter = {
    apiBaseUrl: 'https://app.ayrshare.com/api',

    /**
     * Fetches all insights data from the Ayrshare API.
     * It makes two calls: one to get post history and one for social analytics.
     * @param {string} apiKey The user's API key for Ayrshare.
     * @returns {Promise<object|null>} A promise that resolves with the formatted insights data.
     */
    async fetchInsights(apiKey) {
        if (!apiKey) {
            helpers.showToast('API Key is missing.', 'error');
            helpers.log('Attempted to fetch data without an API Key.', 'ERROR');
            return null;
        }

        helpers.log('Fetching insights from Ayrshare...');

        try {
            // Perform API calls in parallel to save time
            const [historyData, socialAnalyticsData] = await Promise.all([
                this.fetchEndpoint(apiKey, '/history'),
                this.fetchEndpoint(apiKey, '/analytics/social')
            ]);

            if (!historyData || !socialAnalyticsData) {
                throw new Error('One or more API calls failed to return data.');
            }

            const formattedData = this.formatData(historyData, socialAnalyticsData);
            helpers.log('Successfully fetched and combined data from Ayrshare.');
            return formattedData;

        } catch (error) {
            helpers.showToast('Failed to fetch data from Ayrshare.', 'error');
            helpers.log(`Ayrshare API Error: ${error.message}`, 'ERROR');
            console.error(error);
            return null;
        }
    },

    /**
     * A generic helper to fetch data from a specific Ayrshare endpoint.
     * @param {string} apiKey The user's API key.
     * @param {string} path The endpoint path (e.g., '/history').
     * @returns {Promise<object>} The JSON response from the API.
     */
    async fetchEndpoint(apiKey, path) {
        const response = await fetch(`${this.apiBaseUrl}${path}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API Error for ${path}: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Formats the raw API data from Ayrshare's endpoints into our standardized dashboard structure.
     * @param {object} historyData The response from the /history endpoint.
     * @param {object} socialAnalyticsData The response from the /analytics/social endpoint.
     * @returns {object} A standardized data object for the dashboard.
     */
    formatData(historyData, socialAnalyticsData) {
        // The structure of the response is based on the Ayrshare docs provided by the user.
        const posts = Array.isArray(historyData) ? historyData : (historyData.history || []);
        const analytics = socialAnalyticsData || {};

        const formatted = {
            kpis: { reach: 0, engagements: 0, followers: 0, videoViews: 0 },
            // Growth data is not directly available, so we leave it empty.
            // A more advanced implementation could derive it from post history if needed.
            growth: [],
            topPosts: []
        };

        // 1. Process Profile-level Analytics for KPIs
        let totalFollowers = 0;
        if (analytics.social) {
            Object.values(analytics.social).forEach(profile => {
                totalFollowers += profile.followers || 0;
            });
        }
        formatted.kpis.followers = totalFollowers;

        // 2. Process Post History for Posts and remaining KPIs
        posts.forEach(post => {
            // Ayrshare's /history endpoint may not contain detailed stats like reach or engagement.
            // These often come from /analytics/post, but that would exceed the 20 req/month limit.
            // We will derive what we can from the /history object.
            const postEngagements = (post.stats?.likes || 0) + (post.stats?.comments || 0) + (post.stats?.shares || 0);

            // Summing up stats for KPIs. Note: This is a rough estimation.
            formatted.kpis.engagements += postEngagements;

            // Creating the standardized post object for the 'Top Posts' section
            formatted.topPosts.push({
                platform: post.platform.toLowerCase(),
                id: post.id,
                thumbnail: post.mediaUrls?.[0] || 'https://via.placeholder.com/300x200',
                caption: post.post,
                url: post.postUrl,
                stats: {
                    likes: post.stats?.likes || 0,
                    comments: post.stats?.comments || 0,
                    saves: 'N/A', // Not provided in history endpoint
                    reach: 'N/A', // Not provided in history endpoint
                    engagement: postEngagements
                },
                timestamp: post.timestamp || post.created_at
            });
        });

        helpers.log("KPIs for Reach and Video Views are not available in the /history or /analytics/social endpoints.", "WARN");

        // Sort posts by engagement
        formatted.topPosts.sort((a, b) => b.stats.engagement - a.stats.engagement);

        return formatted;
    }
};
