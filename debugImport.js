/**
 * Debug script to identify why ticker fetching is failing
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API configuration
const API_KEY = 'gBEpwqDpCcL1SLHyjVdi3HZ_8YXccEHO';
const BASE_URL = 'https://api.polygon.io';

async function debugPolygonAPI() {
  try {
    console.log('Starting Polygon.io API debug...');
    
    // Test basic ticker endpoint with minimal filtering
    const endpoint = '/v3/reference/tickers';
    const params = {
      apiKey: API_KEY,
      active: true,
      limit: 100
    };
    
    console.log(`Making API request to: ${BASE_URL}${endpoint} with params:`, params);
    
    // Make request with axios
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Save raw response to file for inspection
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const rawResponseFile = path.join(debugDir, 'raw_ticker_response.json');
    fs.writeFileSync(rawResponseFile, JSON.stringify(response.data, null, 2));
    
    console.log(`Raw API response saved to ${rawResponseFile}`);
    
    // Analyze response structure
    if (response.data.results && response.data.results.length > 0) {
      console.log(`Received ${response.data.results.length} tickers`);
      
      // Analyze first 5 tickers to understand structure
      const sampleTickers = response.data.results.slice(0, 5);
      
      // Check for exchange fields
      const exchangeFields = {};
      sampleTickers.forEach(ticker => {
        // Log all available fields for analysis
        console.log(`\nTicker ${ticker.ticker} fields:`);
        Object.keys(ticker).forEach(key => {
          console.log(`  ${key}: ${JSON.stringify(ticker[key])}`);
          
          // Track exchange-related fields specifically
          if (key.includes('exchange') || key.includes('market')) {
            if (!exchangeFields[key]) {
              exchangeFields[key] = new Set();
            }
            exchangeFields[key].add(ticker[key]);
          }
        });
      });
      
      // Log exchange field analysis
      console.log('\nExchange field analysis:');
      Object.keys(exchangeFields).forEach(field => {
        console.log(`  ${field}: ${Array.from(exchangeFields[field]).join(', ')}`);
      });
      
      // Count tickers by exchange to verify filtering logic
      const exchangeCounts = {};
      response.data.results.forEach(ticker => {
        const exchange = ticker.primary_exchange || ticker.market || 'unknown';
        exchangeCounts[exchange] = (exchangeCounts[exchange] || 0) + 1;
      });
      
      console.log('\nTickers by exchange:');
      Object.keys(exchangeCounts).forEach(exchange => {
        console.log(`  ${exchange}: ${exchangeCounts[exchange]}`);
      });
      
      // Test our filtering logic
      const allowedExchanges = ['NYSE', 'NASDAQ'];
      const filteredResults = response.data.results.filter(ticker => 
        (allowedExchanges.includes(ticker.market) || 
         allowedExchanges.includes(ticker.primary_exchange)) &&
        ticker.type !== 'ETF' && 
        !ticker.name?.includes('ETF') &&
        !ticker.ticker?.includes('-')
      );
      
      console.log(`\nAfter filtering: ${filteredResults.length} tickers remain`);
      
      // Save filtered results for inspection
      const filteredFile = path.join(debugDir, 'filtered_tickers.json');
      fs.writeFileSync(filteredFile, JSON.stringify(filteredResults, null, 2));
      
      console.log(`Filtered tickers saved to ${filteredFile}`);
    } else {
      console.error('No results found in API response');
    }
    
    console.log('Debug complete');
  } catch (error) {
    console.error('Error in debug process:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

debugPolygonAPI()
  .then(() => console.log('Debug process completed'))
  .catch(error => console.error('Debug process failed:', error));
