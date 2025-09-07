// FILE: js/adapters/google_sheet.js

/**
 * API Adapter for the Google Sheet data source.
 */
const googleSheetAdapter = {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQxsXKj04wgpI9UepTpVQcKXmYDShpx-1WWVmteKLZT-RHWURLeh0pK1ACg-br4vHfzwbLsjGUrDR_Q/pub?output=csv',

    /**
     * Fetches and parses the CSV data from the Google Sheet.
     * @returns {Promise<Array>} A promise that resolves to an array of post objects.
     */
    async fetchData() {
        try {
            const response = await fetch(this.sheetUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data from Google Sheet: ${response.statusText}`);
            }
            const csvText = await response.text();
            return this.parseCsv(csvText);
        } catch (error) {
            helpers.log(`Error fetching or parsing Google Sheet data: ${error.message}`, 'ERROR');
            throw error;
        }
    },

    /**
     * Parses a CSV string into an array of objects.
     * @param {string} csvText The CSV string to parse.
     * @returns {Array} An array of objects representing the CSV data.
     */
    parseCsv(csvText) {
        const lines = csvText.split('\\n');
        const headers = lines[0].split('\\t');
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const obj = {};
            const currentLine = lines[i].split('\\t');

            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentLine[j];
            }

            result.push(obj);
        }
        return result;
    }
};
