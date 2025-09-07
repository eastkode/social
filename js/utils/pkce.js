// FILE: js/utils/pkce.js

/**
 * PKCE (Proof Key for Code Exchange) utility for OAuth 2.0.
 * This is used for the LinkedIn authentication flow to enhance security.
 */
const pkceUtil = {
    /**
     * Generates a random string for the code verifier.
     * @param {number} length The length of the string to generate.
     * @returns {string} A random string.
     */
    generateCodeVerifier(length) {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    },

    /**
     * Generates a code challenge from a code verifier using SHA256 hashing.
     * @param {string} verifier The code verifier string.
     * @returns {Promise<string>} A promise that resolves to the Base64 URL-encoded code challenge.
     */
    async generateCodeChallenge(verifier) {
        // SHA256 hash the verifier
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);

        // Base64 URL encode the hash
        return this.base64UrlEncode(digest);
    },

    /**
     * Converts a buffer to a Base64 URL-encoded string.
     * @param {ArrayBuffer} buffer The buffer to encode.
     * @returns {string} The Base64 URL-encoded string.
     */
    base64UrlEncode(buffer) {
        // Convert ArrayBuffer to string
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        // Base64 encode, then make it URL-safe
        return window.btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    /**
     * Generates a random state string for CSRF protection.
     * @returns {string} A random state string.
     */
    generateState() {
        return this.generateCodeVerifier(32);
    }
};
