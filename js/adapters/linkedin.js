// FILE: js/adapters/linkedin.js

/**
 * API Adapter for LinkedIn.
 * Handles OAuth 2.0 with PKCE and data fetching.
 */
const linkedinAdapter = {
    // --- IMPORTANT: REPLACE WITH YOUR LINKEDIN APP INFO ---
    clientId: '86c13pla91jwcl',
    // Make sure this Redirect URI is configured in your LinkedIn App settings
    redirectUri: window.location.origin + window.location.pathname,
    // ---------------------------------------------------------

    // API endpoints
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken', // Note: This needs a server-side proxy due to CORS
    proxyTokenUrl: 'YOUR_SERVER_SIDE_PROXY_URL_FOR_TOKEN_EXCHANGE', // See note below

    // Scopes for required permissions
    scope: 'r_liteprofile r_emailaddress w_member_social r_organization_social rw_organization_admin',

    accessToken: null,

    /**
     * NOTE ON TOKEN EXCHANGE:
     * LinkedIn's token endpoint does not support CORS for client-side requests.
     * This means you CANNOT call it directly from the browser. You need a server-side
     * proxy to handle the token exchange. The proxy will receive the 'code' from your
     * client, then make a secure server-to-server request to LinkedIn's tokenUrl,
     * and finally return the access token to the client.
     *
     * For this example, we'll assume `proxyTokenUrl` is an endpoint you've set up.
     * The proxy would take a POST request with `{ code, verifier, clientId, redirectUri }`
     * and handle the rest.
     */

    /**
     * Initializes the adapter, checking for an existing token or an auth callback.
     * @returns {Promise<boolean>} True if user is authenticated, false otherwise.
     */
    async init() {
        this.loadToken();
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
            helpers.log('Detected LinkedIn auth callback.');
            return await this.handleAuthCallback(code, state);
        }

        if (this.accessToken) {
            helpers.log('LinkedIn user is authenticated from stored token.');
            return true;
        }

        return false;
    },

    /**
     * Redirects the user to LinkedIn's authorization URL to start the login flow.
     */
    async login() {
        helpers.log('Starting LinkedIn login flow...');
        const state = pkceUtil.generateState();
        const codeVerifier = pkceUtil.generateCodeVerifier(128);
        const codeChallenge = await pkceUtil.generateCodeChallenge(codeVerifier);

        // Store verifier and state to check against upon callback
        sessionStorage.setItem('linkedin_pkce_verifier', codeVerifier);
        sessionStorage.setItem('linkedin_auth_state', state);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: state,
            scope: this.scope,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        window.location.href = `${this.authUrl}?${params.toString()}`;
    },

    logout() {
        this.accessToken = null;
        localStorage.removeItem('linkedin_access_token');
        helpers.log('LinkedIn user logged out.');
    },

    /**
     * Handles the callback from LinkedIn after user authorization.
     * @param {string} code The authorization code from URL params.
     * @param {string} state The state from URL params.
     * @returns {Promise<boolean>} True if token exchange is successful.
     */
    async handleAuthCallback(code, state) {
        const storedState = sessionStorage.getItem('linkedin_auth_state');
        const codeVerifier = sessionStorage.getItem('linkedin_pkce_verifier');

        // Clean up URL and session storage
        window.history.replaceState({}, document.title, window.location.pathname);
        sessionStorage.removeItem('linkedin_auth_state');
        sessionStorage.removeItem('linkedin_pkce_verifier');

        if (state !== storedState) {
            helpers.showToast('LinkedIn auth failed: state mismatch.', 'error');
            helpers.log('LinkedIn state mismatch. Potential CSRF attack.', 'ERROR');
            return false;
        }

        if (!codeVerifier) {
            helpers.showToast('LinkedIn auth failed: missing code verifier.', 'error');
            helpers.log('Could not find PKCE code verifier in session storage.', 'ERROR');
            return false;
        }

        try {
            helpers.toggleSpinner(true);
            const token = await this.exchangeCodeForToken(code, codeVerifier);
            if (token) {
                this.accessToken = token;
                this.saveToken();
                helpers.showToast('LinkedIn login successful!', 'success');
                helpers.log('Successfully exchanged code for LinkedIn access token.');
                return true;
            }
            return false;
        } catch (error) {
            helpers.showToast('LinkedIn token exchange failed.', 'error');
            helpers.log(`LinkedIn token exchange error: ${error.message}`, 'ERROR');
            console.error(error);
            return false;
        } finally {
            helpers.toggleSpinner(false);
        }
    },

    /**
     * Exchanges the authorization code for an access token via the server-side proxy.
     * @param {string} code The authorization code.
     * @param {string} verifier The PKCE code verifier.
     * @returns {Promise<string|null>} The access token or null.
     */
    async exchangeCodeForToken(code, verifier) {
        // In a real application, you MUST use a server-side proxy.
        // The following is a placeholder for that interaction.
        helpers.log('Exchanging auth code for token via proxy...');

        // This is a mock of the proxy call.
        // If you don't have a proxy, this will fail due to CORS.
        if (this.proxyTokenUrl === 'YOUR_SERVER_SIDE_PROXY_URL_FOR_TOKEN_EXCHANGE') {
            const errorMsg = 'LinkedIn token exchange requires a server-side proxy. Please configure `proxyTokenUrl` in linkedin.js.';
            helpers.log(errorMsg, 'ERROR');
            throw new Error(errorMsg);
        }

        const response = await fetch(this.proxyTokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                verifier: verifier,
                clientId: this.clientId,
                redirectUri: this.redirectUri
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error_description || 'Proxy request failed');
        }

        const data = await response.json();
        return data.access_token;
    },

    saveToken() {
        if (this.accessToken) {
            localStorage.setItem('linkedin_access_token', this.accessToken);
        }
    },

    loadToken() {
        const token = localStorage.getItem('linkedin_access_token');
        if (token) {
            this.accessToken = token;
        }
    },

    /**
     * Fetches all insights data for the given date range.
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Promise<object>} A promise that resolves with the formatted insights data.
     */
    async fetchInsights(startDate, endDate) {
        if (!this.accessToken) {
            helpers.showToast('Not logged into LinkedIn.', 'error');
            return null;
        }
        helpers.log('Fetching LinkedIn insights...');

        try {
            const orgs = await this.getManagedOrganizations();
            if (!orgs || orgs.length === 0) {
                helpers.showToast('No LinkedIn Organizations found for this user.', 'error');
                helpers.log('No managed LinkedIn organizations found.', 'WARN');
                return null;
            }

            // Using the first organization found
            const orgUrn = orgs[0].organization;
            helpers.log(`Using organization: ${orgUrn}`);

            const [orgStats, postStats] = await Promise.all([
                this.fetchOrganizationStats(orgUrn, startDate, endDate),
                this.fetchPostStats(orgUrn)
            ]);

            const combinedData = this.formatData(orgStats, postStats);
            helpers.log('Successfully fetched and combined LinkedIn insights.');
            return combinedData;
        } catch (error) {
            helpers.showToast('Failed to fetch LinkedIn data.', 'error');
            helpers.log(`Error fetching LinkedIn insights: ${error.message || JSON.stringify(error)}`, 'ERROR');
            console.error(error);
            return null;
        }
    },

    /**
     * Makes an authenticated call to the LinkedIn API.
     * @param {string} url The full API URL.
     * @returns {Promise<object>}
     */
    async api(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'LinkedIn-Version': '202305', // Example version
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'LinkedIn API request failed');
        }
        return response.json();
    },

    async getManagedOrganizations() {
        const url = 'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee';
        const data = await this.api(url);
        return data.elements;
    },

    async fetchOrganizationStats(orgUrn, startDate, endDate) {
        // LinkedIn API requires time ranges to be specified like this
        const startTs = startDate.getTime();
        const endTs = endDate.getTime();
        const url = `https://api.linkedin.com/v2/organizationPageStatistics?q=organization&organization=${orgUrn}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${startTs}&timeIntervals.timeRange.end=${endTs}`;
        const data = await this.api(url);
        return data.elements;
    },

    async fetchPostStats(orgUrn) {
        // Fetch recent posts (shares)
        const author = `urn:li:organization:${orgUrn.split(':').pop()}`;
        const url = `https://api.linkedin.com/v2/shares?q=authors&authors=List(${encodeURIComponent(author)})&count=25`;
        const data = await this.api(url);
        return data.elements;
    },

    /**
     * Formats raw API data into a standardized structure for the dashboard.
     * @param {Array} orgStats
     * @param {Array} postStats
     * @returns {object} Standardized data object.
     */
    formatData(orgStats, postStats) {
        const formatted = {
            kpis: { reach: 0, engagements: 0, followers: 0, videoViews: 0 },
            growth: [], // { date, value }
            topPosts: []
        };

        // Process organization stats
        orgStats.forEach(stat => {
            formatted.kpis.reach += stat.totalPageStatistics.impressions.uniqueImpressionsCount || 0;
            formatted.kpis.engagements += stat.totalPageStatistics.engagement || 0;
            formatted.kpis.followers += stat.totalFollowerCounts?.organicFollowerCount || 0;

            formatted.growth.push({
                date: new Date(stat.timeRange.start).toISOString(),
                value: stat.totalFollowerCounts?.organicFollowerCount || 0,
                platform: 'linkedin'
            });
        });

        // Process post stats
        postStats.forEach(post => {
            const engagement = (post.socialActions?.comments || 0) + (post.socialActions?.likes || 0) + (post.socialActions?.shares || 0);
            formatted.topPosts.push({
                platform: 'linkedin',
                id: post.id,
                thumbnail: post.content?.media?.[0]?.thumbnails?.[0]?.url || 'https://via.placeholder.com/300',
                caption: post.text?.text || '',
                url: `https://www.linkedin.com/feed/update/${post.id}`,
                stats: {
                    likes: post.socialActions?.likes || 0,
                    comments: post.socialActions?.comments || 0,
                    saves: 'N/A',
                    reach: 'N/A', // Post reach is not available in this basic endpoint
                    engagement: engagement
                },
                timestamp: post.created.time
            });
        });

        // Sort posts by engagement
        formatted.topPosts.sort((a, b) => b.stats.engagement - a.stats.engagement);

        return formatted;
    }
};
