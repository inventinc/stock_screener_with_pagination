/**
 * Fetch all stock tickers from Polygon.io API
 * Excludes ETFs as per user requirements
 */

const axios = require('axios');
require('dotenv').config();

// Constants
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';
const MAX_STOCKS = 2000;

/**
 * Fetch all stock tickers from Polygon.io API
 * @returns {Promise<Array>} Array of ticker objects
 */
async function fetchAllTickers() {
  try {
    console.log('Fetching all stock tickers (excluding ETFs)...');
    
    let allTickers = [];
    let hasMore = true;
    let nextUrl = null;
    
    // Fetch first page
    const url = 'https://api.polygon.io/v3/reference/tickers';
    const params = {
      market: 'stocks',
      active: true,
      type: 'CS', // Common Stock only, excludes ETFs
      limit: 1000,
      apiKey: POLYGON_API_KEY
    };
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    if (data.results) {
      // Filter out any ETFs that might have slipped through
      const filteredResults = data.results.filter(ticker => 
        ticker.type === 'CS' && 
        !ticker.name.includes('ETF') && 
        !ticker.name.includes('Exchange Traded Fund')
      );
      
      allTickers = [...allTickers, ...filteredResults];
      nextUrl = data.next_url;
      hasMore = !!nextUrl;
    }
    
    // Fetch additional pages if needed
    while (hasMore && allTickers.length < MAX_STOCKS) {
      console.log(`Fetched ${allTickers.length} tickers so far, getting more...`);
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const nextResponse = await axios.get(`${nextUrl}&apiKey=${POLYGON_API_KEY}`);
      const nextData = nextResponse.data;
      
      if (nextData.results) {
        // Filter out any ETFs that might have slipped through
        const filteredResults = nextData.results.filter(ticker => 
          ticker.type === 'CS' && 
          !ticker.name.includes('ETF') && 
          !ticker.name.includes('Exchange Traded Fund')
        );
        
        allTickers = [...allTickers, ...filteredResults];
        nextUrl = nextData.next_url;
        hasMore = !!nextUrl;
      } else {
        hasMore = false;
      }
      
      // Stop if we've reached the maximum
      if (allTickers.length >= MAX_STOCKS) {
        console.log(`Reached maximum of ${MAX_STOCKS} tickers, stopping fetch`);
        break;
      }
    }
    
    console.log(`Successfully fetched ${allTickers.length} stock tickers (excluding ETFs)`);
    return allTickers;
  } catch (error) {
    console.error('Error fetching tickers:', error.message);
    return [];
  }
}

module.exports = fetchAllTickers;
