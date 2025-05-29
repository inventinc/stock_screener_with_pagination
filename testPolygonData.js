/**
 * Test script to fetch sample data from Polygon.io API for a single company
 * This demonstrates the data structure and fields available for filtering
 */

const axios = require('axios');

// Use the provided API key
const POLYGON_API_KEY = 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';

// Sample company to fetch (Apple)
const SYMBOL = 'AAPL';

/**
 * Fetch ticker details from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Ticker details
 */
async function fetchTickerDetails(symbol) {
  try {
    console.log(`Fetching ticker details for ${symbol}...`);
    const response = await axios.get(`https://api.polygon.io/v3/reference/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching ticker details for ${symbol}:`, error.message);
    if (error.response) {
      console.error('API response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Fetch latest price data from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Latest price data
 */
async function fetchLatestPrice(symbol) {
  try {
    console.log(`Fetching latest price data for ${symbol}...`);
    const response = await axios.get(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    return response.data.ticker;
  } catch (error) {
    console.error(`Error fetching latest price for ${symbol}:`, error.message);
    if (error.response) {
      console.error('API response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Fetch financial ratios from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Financial ratios
 */
async function fetchFinancialRatios(symbol) {
  try {
    console.log(`Fetching financial ratios for ${symbol}...`);
    const response = await axios.get(`https://api.polygon.io/v3/reference/financials/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY,
        limit: 1
      }
    });
    
    return response.data.results[0];
  } catch (error) {
    console.error(`Error fetching financial ratios for ${symbol}:`, error.message);
    if (error.response) {
      console.error('API response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Main function to fetch and display sample data
 */
async function fetchSampleData() {
  try {
    // Fetch all data in parallel
    const [tickerDetails, latestPrice, financialRatios] = await Promise.all([
      fetchTickerDetails(SYMBOL),
      fetchLatestPrice(SYMBOL),
      fetchFinancialRatios(SYMBOL)
    ]);
    
    // Prepare sample stock data in the format used by our application
    const sampleStock = {
      symbol: SYMBOL,
      name: tickerDetails.name,
      exchange: tickerDetails.primary_exchange,
      sector: tickerDetails.sic_description,
      industry: tickerDetails.standard_industrial_classification ? 
               tickerDetails.standard_industrial_classification.industry : 'Unknown',
      price: latestPrice?.lastTrade?.p || 0,
      marketCap: latestPrice?.day?.v * (latestPrice?.lastTrade?.p || 0),
      avgDollarVolume: latestPrice?.day?.v * (latestPrice?.lastTrade?.p || 0),
      lastUpdated: new Date()
    };
    
    // Add financial ratios if available
    if (financialRatios) {
      sampleStock.netDebtToEBITDA = financialRatios.ratios?.debtToEbitda || null;
      sampleStock.evToEBIT = financialRatios.ratios?.evToEbit || null;
      sampleStock.rotce = financialRatios.ratios?.returnOnTangibleEquity || null;
    }
    
    // Display the sample data
    console.log('\n=== SAMPLE STOCK DATA FOR FILTERS ===\n');
    console.log(JSON.stringify(sampleStock, null, 2));
    
    // Display raw API responses for reference
    console.log('\n=== RAW API RESPONSES ===\n');
    console.log('Ticker Details:');
    console.log(JSON.stringify(tickerDetails, null, 2));
    
    console.log('\nLatest Price:');
    console.log(JSON.stringify(latestPrice, null, 2));
    
    console.log('\nFinancial Ratios:');
    console.log(JSON.stringify(financialRatios, null, 2));
    
  } catch (error) {
    console.error('Error fetching sample data:', error.message);
  }
}

// Run the sample data fetch
fetchSampleData();
