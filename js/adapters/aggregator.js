// FILE: js/adapters/aggregator.js

/**
 * API Adapter for a Social Media Aggregator Service (e.g., Ayrshare).
 * This simplifies data fetching by using a single API key.
 */
const aggregatorAdapter = {
    // Example using Ayrshare's API endpoint.
    // The user should replace this if they use a different service.
    apiBaseUrl: 'https://app.ayrshare.com/api',

    /**
     * Fetches all insights data from the aggregator service.
     * @param {string} apiKey The user's API key for the aggregator service.
     * @param {Date} startDate The start of the date range.
     * @param {Date} endDate The end of the date range.
     * @returns {Promise<object|null>} A promise that resolves with the formatted insights data.
     */
    async fetchInsights(apiKey, startDate, endDate) {
        if (!apiKey) {
            helpers.showToast('API Key is missing.', 'error');
            helpers.log('Attempted to fetch data without an API Key.', 'ERROR');
            return null;
        }

        helpers.log('Fetching insights from aggregator service...');

        // Aggregator services have different endpoints. '/history' is a common one for fetching past posts.
        // A real implementation might need multiple calls (e.g., one for analytics, one for post history).
        // This is a simplified example assuming a '/history' endpoint.
        const endpoint = `${this.apiBaseUrl}/history`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET', // Or 'POST' depending on the service
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                // Body might be needed for POST requests, e.g.:
                // body: JSON.stringify({
                //     "startDate": startDate.toISOString(),
                //     "endDate": endDate.toISOString()
                // })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `API Error: ${response.statusText}`);
            }

            const rawData = await response.json();

            // The structure of rawData depends entirely on the service used.
            // We pass it to a formatting function to standardize it for our dashboard.
            const formattedData = this.formatData(rawData);
            helpers.log('Successfully fetched and formatted data from aggregator.');
            return formattedData;

        } catch (error) {
            helpers.showToast('Failed to fetch data from aggregator.', 'error');
            helpers.log(`Aggregator API Error: ${error.message}`, 'ERROR');
            console.error(error);
            return null;
        }
    },

    /**
     * Formats the raw API data from the aggregator into the standardized structure our dashboard uses.
     * @param {object} rawData The raw response from the aggregator API.
     * @returns {object} A standardized data object for the dashboard.
     */
    formatData(rawData) {
        // IMPORTANT: This function's logic is HIGHLY dependent on the chosen aggregator's API response format.
        // The following is a plausible example based on what an API like Ayrshare might return.
        // The user MUST adjust this based on their service's documentation.

        const posts = Array.isArray(rawData.history) ? rawData.history : (Array.isArray(rawData) ? rawData : []);

        const formatted = {
            kpis: { reach: 0, engagements: 0, followers: 0, videoViews: 0 },
            growth: [], // Note: Aggregators might not provide daily follower growth easily.
            topPosts: []
        };

        posts.forEach(post => {
            // Summing up stats for KPIs
            const postReach = post.stats?.reach || 0;
            const postEngagements = post.stats?.engagement || post.stats?.likes || 0 + post.stats?.comments || 0;
            const postVideoViews = post.stats?.video_views || 0;

            formatted.kpis.reach += postReach;
            formatted.kpis.engagements += postEngagements;
            formatted.kpis.videoViews += postVideoViews;

            // Creating the standardized post object for the 'Top Posts' section
            formatted.topPosts.push({
                platform: post.platform.toLowerCase(),
                id: post.id,
                thumbnail: post.media_urls?.[0] || 'https://via.placeholder.com/300x200',
                caption: post.post,
                url: post.postUrl,
                stats: {
                    likes: post.stats?.likes || 0,
                    comments: post.stats?.comments || 0,
                    saves: post.stats?.saves || 'N/A',
                    reach: postReach,
                    engagement: postEngagements
                },
                timestamp: post.created_at || post.timestamp
            });
        });

        // Followers KPI would likely come from a different endpoint, e.g., `/analytics`.
        // For this example, we leave it at 0.
        helpers.log("Follower/Growth data may require a separate '/analytics' endpoint.", "WARN");

        // Sort posts by engagement
        formatted.topPosts.sort((a, b) => b.stats.engagement - a.stats.engagement);

        return formatted;
    }
};
