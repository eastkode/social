// FILE: js/utils/helpers.js

/**
 * General utility functions for the dashboard.
 */
const helpers = {
    /**
     * Displays a toast notification.
     * @param {string} message The message to display.
     * @param {string} type 'success' or 'error'.
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    },

    /**
     * Logs messages to the on-screen log console.
     * @param {string} message The message to log.
     * @param {string} [type='INFO'] The type of log (e.g., 'ERROR', 'WARN').
     */
    log(message, type = 'INFO') {
        const output = document.getElementById('logs-output');
        const timestamp = new Date().toISOString();
        const existingText = output.textContent;
        output.textContent = `[${timestamp}] [${type}] ${message}\n${existingText}`;
    },

    /**
     * Toggles the loading spinner.
     * @param {boolean} show True to show, false to hide.
     */
    toggleSpinner(show) {
        const spinner = document.getElementById('loading-spinner');
        spinner.style.display = show ? 'flex' : 'none';
    },

    /**
     * Formats a number with commas as thousands separators.
     * @param {number} num The number to format.
     * @returns {string} The formatted number or '—' if input is invalid.
     */
    formatNumber(num) {
        if (typeof num !== 'number') return '—';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Populates the month and year select dropdowns.
     */
    populateDateFilters() {
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();

        // Populate months
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        monthSelect.innerHTML = '<option value="all">All Months</option>';
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = month;
            if (index === currentMonth) {
                option.selected = true;
            }
            monthSelect.appendChild(option);
        });

        // Populate years (last 5 years)
        yearSelect.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    },

    /**
     * Sets the copyright year in the footer.
     */
    setFooterYear() {
        document.getElementById('footer-year').textContent = new Date().getFullYear();
    },

    /**
     * Trims a string to a specified length and adds '...'.
     * @param {string} text The text to trim.
     * @param {number} maxLength The maximum length.
     * @returns {string} The trimmed text.
     */
    trimText(text, maxLength = 100) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    },

    /**
     * Exports data to a file (JSON or CSV).
     * @param {object} data The data object to export.
     * @param {string} filename The name of the file.
     * @param {string} type 'json' or 'csv'.
     */
    exportData(data, filename, type = 'json') {
        if (type === 'json') {
            this.exportAsJson(data, filename);
        } else if (type === 'csv') {
            this.exportAsCsv(data, filename);
        }
    },

    exportAsJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.log(`Exported data as ${filename}.json`);
    },

    exportAsCsv(data, filename) {
        // This is a simplified CSV export for top posts. A real implementation would be more robust.
        const posts = data.topPosts || [];
        if (posts.length === 0) {
            this.showToast('No data to export as CSV', 'error');
            return;
        }

        const headers = ['Platform', 'Caption', 'Likes', 'Comments', 'Saves', 'Reach', 'URL'];
        const rows = posts.map(post => [
            post.platform,
            `"${post.caption.replace(/"/g, '""')}"`,
            post.stats.likes,
            post.stats.comments,
            post.stats.saves || 'N/A',
            post.stats.reach,
            post.url
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.log(`Exported data as ${filename}.csv`);
    }
};
