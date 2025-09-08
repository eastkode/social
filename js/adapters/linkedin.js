// FILE: js/adapters/linkedin.js

/**
 * API Adapter for the LinkedIn API via a Netlify Function proxy.
 */
const linkedinAdapter = {
    /**
     * Fetches post data from the LinkedIn API.
     * @returns {Promise<Array>} A promise that resolves to an array of post objects.
     */
    async fetchData() {
        try {
            // This is a placeholder for the organization ID.
            // In a real application, this would likely be configurable.
            const organizationUrn = 'urn:li:organizationalPage:amityuniversityranchi';

            // 1. Fetch the posts (or rather, the URNs of the posts)
            const postUrns = await this.fetchPostUrns(organizationUrn);

            // 2. For each post URN, fetch the post details and social metadata
            const posts = await Promise.all(
                postUrns.map(urn => this.fetchPostDetails(urn))
            );

            // 3. Transform the data into the format expected by the app
            return this.transformData(posts);

        } catch (error) {
            helpers.log(`Error fetching LinkedIn data: ${error.message}`, 'ERROR');
            throw new Error(`Could not load data from LinkedIn. Details: ${error.message}`);
        }
    },

    /**
     * Fetches the URNs of the posts for a given organization.
     * @param {string} organizationUrn The URN of the organization.
     * @returns {Promise<Array>} A promise that resolves to an array of post URN strings.
     */
    async fetchPostUrns(organizationUrn) {
        // The /dmaFeedContentsExternal endpoint can be used to find posts by author.
        const path = `/dmaFeedContentsExternal?q=author&author=${encodeURIComponent(organizationUrn)}`;
        const response = await this.proxyFetch(path);

        // The response from this endpoint contains a list of post URNs.
        // The exact structure of the response needs to be determined from the API documentation or by testing.
        // For now, I'll assume it returns an object with an `elements` array of URNs.
        return response.elements || [];
    },

    /**
     * Fetches the details for a single post, including its social metadata.
     * @param {string} postUrn The URN of the post.
     * @returns {Promise<Object>} A promise that resolves to an object containing the post details and social metadata.
     */
    async fetchPostDetails(postUrn) {
        // Fetch post details from /dmaPosts
        const postDetailsPath = `/dmaPosts/${encodeURIComponent(postUrn)}`;
        const postDetails = await this.proxyFetch(postDetailsPath);

        // Fetch social metadata from /dmaSocialMetadata
        const socialMetadataPath = `/dmaSocialMetadata/${encodeURIComponent(postUrn)}`;
        const socialMetadata = await this.proxyFetch(socialMetadataPath);

        return { ...postDetails, socialMetadata };
    },

    /**
     * Makes a fetch request to our Netlify Function proxy.
     * @param {string} path The LinkedIn API path to request (e.g., /dmaPosts/urn:li:share:123)
     * @returns {Promise<Object>} A promise that resolves to the JSON response.
     */
    async proxyFetch(path) {
        const proxyUrl = `/.netlify/functions/linkedin_proxy?path=${encodeURIComponent(path)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`LinkedIn API proxy request failed: ${response.status} ${errorData.error || ''}`);
        }
        return response.json();
    },

    /**
     * Transforms the raw API data into the format expected by the application.
     * @param {Array} posts The array of post objects from the API.
     * @returns {Array} An array of post objects in the application's format.
     */
    transformData(posts) {
        return posts.map(post => {
            // The mapping of fields will depend on the actual structure of the API response.
            // This is a placeholder based on the documentation.
            const stats = post.socialMetadata || {};
            return {
                platform: 'linkedin',
                id: post.id,
                thumbnail: post.content?.media?.thumbnails?.[0]?.url || 'https://via.placeholder.com/300x200',
                caption: post.content?.text,
                url: `https://www.linkedin.com/feed/update/${post.id}`,
                stats: {
                    likes: stats.reactionCount || 0,
                    comments: stats.commentCount || 0,
                    saves: 'N/A',
                    reach: 0, // Reach data might come from a different endpoint.
                    videoViews: 0, // Video views data might come from a different endpoint.
                    engagement: (stats.reactionCount || 0) + (stats.commentCount || 0)
                },
                timestamp: new Date(post.createdAt).getTime()
            };
        });
    }
};
