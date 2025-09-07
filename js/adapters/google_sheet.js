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
                throw new Error(`Failed to fetch data from Google Sheet: ${response.status} ${response.statusText}`);
            }
            const csvText = await response.text();
            if (!csvText) {
                throw new Error('Fetched data is empty.');
            }
            return this.parseCsv(csvText);
        } catch (error) {
            helpers.log(`Error fetching or parsing Google Sheet data: ${error.message}`, 'ERROR');
            throw new Error(`Could not load data from the source. Please check the sheet URL and format. Details: ${error.message}`);
        }
    },

    /**
     * Parses a CSV string into an array of objects.
     * @param {string} csvText The CSV string to parse.
     * @returns {Array} An array of objects representing the CSV data.
     */
    parseCsv(csvText) {
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });
        return result.data;
    }
};
