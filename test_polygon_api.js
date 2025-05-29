/**
 * Standalone test script for Polygon.io API connectivity
 * This script tests direct connectivity to various Polygon.io endpoints
 * to diagnose why the ticker fetching is stuck
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API configuration
const API_KEY = 'gBEpwqDpCcL1SLHyjVdi3HZ_8YXccEHO';
const BASE_URL = 'https://api.polygon.io';

// Test endpoints
const TEST_ENDPOINTS = [
  {
    name: 'Ticker Details (AAPL)',
    endpoint: '/v3/reference/tickers/AAPL',
    params: {}
  },
  {
    name: 'Stock Price (AAPL)',
    endpoint: '/v2/aggs/ticker/AAPL/prev',
    params: {}
  },
  {
    name: 'Tickers List (Small)',
    endpoint: '/v3/reference/tickers',
    params: { market: 'stocks', active: true, limit: 5 }
  },
  {
    name: 'Financials (AAPL)',
    endpoint: '/v3/reference/financials/AAPL',
    params: { limit: 1 }
  }
];

// Log file
const LOG_FILE = path.join(__dirname, 'polygon_api_test.log');

/**
 * Log message to console and file
 * @param {string} message - Message to log
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Make API request to Polygon.io with timeout
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  // Add API key to params
  params.apiKey = API_KEY;
  
  // Build URL
  const url = `${BASE_URL}${endpoint}`;
  
  log(`Making API request to: ${url}`);
  
  try {
    // Make request with axios and timeout
    const response = await axios.get(url, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    log(`Response status: ${response.status}`);
    
    // Check for rate limit
    if (response.status === 429) {
      const resetTime = response.headers['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : new Date(Date.now() + 60000);
      
      log(`Rate limit exceeded. Reset time: ${resetDate.toISOString()}`);
      return { error: 'Rate limit exceeded', resetTime: resetDate.toISOString() };
    }
    
    // Parse response
    const data = response.data;
    log(`Response received successfully. Data type: ${typeof data}`);
    
    if (data.results) {
      log(`Results count: ${Array.isArray(data.results) ? data.results.length : 'object'}`);
    }
    
    return data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      log(`API error: ${error.response.status} ${error.response.statusText}`);
      return { error: `API error: ${error.response.status} ${error.response.statusText}` };
    } else if (error.request) {
      // The request was made but no response was received
      log(`No response received: ${error.message}`);
      return { error: `No response received: ${error.message}` };
    } else {
      // Something happened in setting up the request that triggered an Error
      log(`Error in API request: ${error.message}`);
      return { error: error.message };
    }
  }
}

/**
 * Test all endpoints
 */
async function testAllEndpoints() {
  log('Starting Polygon.io API connectivity tests');
  
  // Clear log file
  fs.writeFileSync(LOG_FILE, '');
  
  // Test each endpoint
  for (const test of TEST_ENDPOINTS) {
    log(`\n=== Testing ${test.name} ===`);
    
    try {
      const startTime = Date.now();
      const response = await makeApiRequest(test.endpoint, test.params);
      const endTime = Date.now();
      
      log(`Request completed in ${endTime - startTime}ms`);
      
      if (response.error) {
        log(`Test FAILED: ${response.error}`);
      } else {
        log(`Test PASSED: Response received successfully`);
        
        // Save sample response
        const sampleFile = path.join(__dirname, `sample_${test.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
        fs.writeFileSync(sampleFile, JSON.stringify(response, null, 2));
        log(`Sample response saved to ${sampleFile}`);
      }
    } catch (error) {
      log(`Test ERROR: ${error.message}`);
    }
  }
  
  log('\n=== Testing Tickers Pagination ===');
  try {
    log('Testing pagination with axios to simulate getAllTickers function');
    
    const startTime = Date.now();
    const endpoint = '/v3/reference/tickers';
    const params = { market: 'stocks', active: true, limit: 100 };
    
    const response = await makeApiRequest(endpoint, params);
    const endTime = Date.now();
    
    log(`Initial request completed in ${endTime - startTime}ms`);
    
    if (response.error) {
      log(`Pagination test FAILED: ${response.error}`);
    } else if (response.next_url) {
      log(`Pagination test PASSED: next_url found: ${response.next_url}`);
      
      // Test following the next_url
      log('Testing next_url pagination');
      
      const nextStartTime = Date.now();
      
      // For next_url, we need to make a direct axios request since it's a full URL
      try {
        // Make request with axios
        const nextResponse = await axios.get(response.next_url, {
          params: { apiKey: API_KEY },
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });
        
        const nextEndTime = Date.now();
        log(`Next page request completed in ${nextEndTime - nextStartTime}ms`);
        
        if (nextResponse.status === 200) {
          const nextData = nextResponse.data;
          log(`Next page response received successfully. Results count: ${nextData.results ? nextData.results.length : 0}`);
          log('Pagination test PASSED: Successfully retrieved second page');
        } else {
          log(`Next page request failed: ${nextResponse.status}`);
          log('Pagination test FAILED: Could not retrieve second page');
        }
      } catch (error) {
        if (error.response) {
          log(`Next page request error: ${error.response.status} ${error.response.statusText}`);
        } else {
          log(`Next page request error: ${error.message}`);
        }
        log('Pagination test FAILED: Error retrieving second page');
      }
    } else {
      log('Pagination test INCONCLUSIVE: No next_url found in response');
    }
  } catch (error) {
    log(`Pagination test ERROR: ${error.message}`);
  }
  
  log('\nAll tests completed. Check the log file for details.');
}

// Run tests
testAllEndpoints().catch(error => {
  log(`Unhandled error in test script: ${error.message}`);
});
