// FILE: js/adapters/aggregator.js

/**
 * API Adapter for the Ayrshare API.
 * Final, corrected version with resilient /history fetching.
 */
const aggregatorAdapter = {
    apiBaseUrl: 'https://api.ayrshare.com/api',

    /**
     * Fetches the user's post history. Handles errors gracefully.
     * @param {string} apiKey The user's API key.
     * @returns {Promise<Array>} A promise that resolves to an array of post objects, or an empty array on error.
     */
    async fetchHistory(apiKey) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/history`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
            });
            if (!response.ok) {
                helpers.log(`API /history returned status ${response.status}. This is expected if no posts exist yet.`, 'WARN');
                return []; // Return empty array on error to prevent crashing
            }
            const data = await response.json();
            return Array.isArray(data) ? data : (data.history || []);
        } catch (error) {
            helpers.log(`Network error fetching history: ${error.message}`, 'ERROR');
            return []; // Return empty array on network error
        }
    },

    /**
     * Sends a new post to the Ayrshare API.
     * @param {object} options
     * @param {string} options.apiKey The user's API key.
     * @param {string} options.post The text content of the post.
     * @param {string[]} options.platforms An array of platforms to post to.
     * @returns {Promise<object>} The JSON response from the API, which includes the new post's ID.
     */
    async createPost({ apiKey, post, platforms }) {
        const response = await fetch(`${this.apiBaseUrl}/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ post, platforms })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API Error for /post: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Fetches analytics for a single post using its ID.
     * @param {object} options
     * @param {string} options.apiKey The user's API key.
     * @param {string} options.id The top-level Ayrshare ID of the post.
     * @returns {Promise<object|null>} The JSON response, or null on error.
     */
    async fetchPostAnalytics({ apiKey, id }) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/analytics/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ id })
            });
            if (!response.ok) {
                const errorData = await response.json();
                helpers.log(`Could not fetch analytics for post ${id}: ${errorData.message}`, 'WARN');
                return null;
            }
            return response.json();
        } catch (error) {
            helpers.log(`Network error fetching analytics for post ${id}: ${error.message}`, 'ERROR');
            return null;
        }
    }
};
