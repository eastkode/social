// FILE: js/adapters/meta.js

/**
 * API Adapter for Meta (Facebook & Instagram).
 * Handles authentication and data fetching using the Facebook JS SDK.
 */
const metaAdapter = {
    // --- IMPORTANT: REPLACE WITH YOUR FACEBOOK APP ID ---
    appId: 'YOUR_FACEBOOK_APP_ID',
    // ----------------------------------------------------

    accessToken: null,
    userId: null,

    /**
     * Initializes the Facebook SDK.
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve) => {
            if (document.getElementById('facebook-jssdk')) {
                helpers.log('Facebook SDK already loaded.');
                return resolve();
            }

            window.fbAsyncInit = () => {
                FB.init({
                    appId: this.appId,
                    cookie: true,
                    xfbml: true,
                    version: 'v18.0'
                });
                helpers.log('Facebook SDK initialized.');

                // Check login status upon initialization
                FB.getLoginStatus(response => {
                    this.handleAuthResponse(response);
                    resolve();
                });
            };

            // Load the SDK script
            (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) {return;}
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
        });
    },

    /**
     * Handles the response from FB.getLoginStatus() or FB.login().
     * @param {object} response The authentication response from the FB SDK.
     */
    handleAuthResponse(response) {
        if (response.status === 'connected') {
            this.accessToken = response.authResponse.accessToken;
            this.userId = response.authResponse.userID;
            helpers.log('Meta user is connected and authenticated.');
            return true;
        } else {
            helpers.log('Meta user is not authenticated.');
            this.accessToken = null;
            this.userId = null;
            return false;
        }
    },

    /**
     * Triggers the login flow.
     * @returns {Promise<boolean>} Resolves to true if login is successful, false otherwise.
     */
    login() {
        return new Promise((resolve, reject) => {
            FB.login(response => {
                if (this.handleAuthResponse(response)) {
                    resolve(true);
                } else {
                    helpers.showToast('Meta login failed or was cancelled.', 'error');
                    helpers.log('Meta login failed.', 'ERROR');
                    reject('Login failed');
                }
            }, {
                scope: 'public_profile,email,pages_show_list,read_insights,pages_read_engagement,instagram_basic,instagram_manage_insights',
                // Add other required permissions here
            });
        });
    },

    /**
     * Logs the user out.
     */
    logout() {
        return new Promise(resolve => {
            FB.logout(() => {
                this.accessToken = null;
                this.userId = null;
                helpers.log('Meta user logged out.');
                resolve();
            });
        });
    },

    /**
     * Fetches all insights data for the given date range.
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Promise<object>} A promise that resolves with the formatted insights data.
     */
    async fetchInsights(startDate, endDate) {
        if (!this.accessToken) {
            helpers.showToast('Not logged into Meta.', 'error');
            return null;
        }
        helpers.log('Fetching Meta insights...');

        try {
            const pages = await this.getManagedPages();
            if (!pages || pages.length === 0) {
                helpers.showToast('No Facebook Pages found for this user.', 'error');
                helpers.log('No managed Facebook pages found.', 'WARN');
                return null;
            }

            // For this example, we'll use the first page. A real app might have a page selector.
            const page = pages[0];
            helpers.log(`Using page: ${page.name} (ID: ${page.id})`);

            const igBusinessAccount = await this.getInstagramAccount(page.id, page.access_token);

            const [pageInsights, igMedia] = await Promise.all([
                this.fetchPageInsights(page.id, page.access_token, startDate, endDate),
                igBusinessAccount ? this.fetchInstagramInsights(igBusinessAccount.id, page.access_token) : Promise.resolve([])
            ]);

            const combinedData = this.formatData(pageInsights, igMedia);
            helpers.log('Successfully fetched and combined Meta insights.');
            return combinedData;

        } catch (error) {
            helpers.showToast('Failed to fetch Meta data.', 'error');
            helpers.log(`Error fetching Meta insights: ${error.message || JSON.stringify(error)}`, 'ERROR');
            console.error(error);
            return null;
        }
    },

    /**
     * Makes a call to the FB Graph API.
     * @param {string} path The API path.
     * @param {string} [method='GET'] The HTTP method.
     * @param {object} [params={}] API parameters.
     * @returns {Promise<object>}
     */
    api(path, method = 'GET', params = {}) {
        return new Promise((resolve, reject) => {
            FB.api(path, method, params, response => {
                if (response.error) {
                    reject(response.error);
                } else {
                    resolve(response);
                }
            });
        });
    },

    async getManagedPages() {
        const response = await this.api('/me/accounts', 'GET', { access_token: this.accessToken });
        return response.data;
    },

    async getInstagramAccount(pageId, pageAccessToken) {
        try {
            const response = await this.api(`/${pageId}`, 'GET', {
                fields: 'instagram_business_account',
                access_token: pageAccessToken
            });
            return response.instagram_business_account;
        } catch (error) {
            helpers.log('Could not find linked Instagram Business Account.', 'WARN');
            return null;
        }
    },

    async fetchPageInsights(pageId, pageAccessToken, startDate, endDate) {
        // Example: fetching page views and new likes over a period
        const since = Math.floor(startDate.getTime() / 1000);
        const until = Math.floor(endDate.getTime() / 1000);

        const params = {
            metric: 'page_views_total,page_fan_adds,page_post_engagements,page_video_views',
            period: 'day',
            since,
            until,
            access_token: pageAccessToken
        };
        const response = await this.api(`/${pageId}/insights`, 'GET', params);
        return response.data;
    },

    async fetchInstagramInsights(igUserId, pageAccessToken) {
        // Get recent media
        const mediaResponse = await this.api(`/${igUserId}/media`, 'GET', {
            fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
            access_token: pageAccessToken
        });

        // Get insights for each media item
        const mediaInsightsPromises = mediaResponse.data.map(async (media) => {
            const insightsResponse = await this.api(`/${media.id}/insights`, 'GET', {
                metric: 'engagement,impressions,reach,saved',
                access_token: pageAccessToken
            });
            media.insights = insightsResponse.data;
            return media;
        });

        return Promise.all(mediaInsightsPromises);
    },

    /**
     * Formats raw API data into a standardized structure for the dashboard.
     * @param {Array} pageInsightsData
     * @param {Array} igMediaData
     * @returns {object} Standardized data object.
     */
    formatData(pageInsightsData, igMediaData) {
        // This is a simplified formatting. A real app would have more complex logic.
        const formatted = {
            kpis: { reach: 0, engagements: 0, followers: 0, videoViews: 0 },
            growth: [], // { date, value }
            topPosts: []
        };

        // Process Page Insights
        pageInsightsData.forEach(metric => {
            switch(metric.name) {
                case 'page_fan_adds':
                    formatted.kpis.followers += metric.values.reduce((sum, v) => sum + v.value, 0);
                    break;
                case 'page_post_engagements':
                    formatted.kpis.engagements += metric.values.reduce((sum, v) => sum + v.value, 0);
                    break;
                case 'page_video_views':
                    formatted.kpis.videoViews += metric.values.reduce((sum, v) => sum + v.value, 0);
                    break;
                // Note: FB Page 'reach' is complex, often fetched with page_impressions. We'll simulate it.
            }
            if(metric.name === 'page_fan_adds') {
                 metric.values.forEach(item => {
                    formatted.growth.push({ date: item.end_time, value: item.value, platform: 'facebook' });
                });
            }
        });

        // Process Instagram Media
        igMediaData.forEach(post => {
            const reach = post.insights.find(m => m.name === 'reach')?.values[0]?.value || 0;
            const engagement = post.insights.find(m => m.name === 'engagement')?.values[0]?.value || 0;
            const saves = post.insights.find(m => m.name === 'saved')?.values[0]?.value || 0;

            formatted.kpis.reach += reach;
            formatted.kpis.engagements += engagement;

            formatted.topPosts.push({
                platform: 'instagram',
                id: post.id,
                thumbnail: post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url,
                caption: post.caption || '',
                url: post.permalink,
                stats: {
                    likes: post.like_count,
                    comments: post.comments_count,
                    saves: saves,
                    reach: reach,
                    engagement: engagement
                },
                timestamp: post.timestamp
            });
        });

        // Sort posts by engagement
        formatted.topPosts.sort((a, b) => b.stats.engagement - a.stats.engagement);

        return formatted;
    }
};
