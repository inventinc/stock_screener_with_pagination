/**
 * Optimized FMP API Import Strategy
 * Designed to maximize throughput with 750 calls/minute quota
 * 
 * Features:
 * - Dynamic concurrency adjustment based on rate limits
 * - Intelligent batching and prioritization
 * - Custom Debt/EBITDA calculation integration
 * - Comprehensive error handling and retry logic
 */

const axios = require('axios');
const debtEBITDACalculator = require('./custom_debt_ebitda_calculator');

// API configuration
const API_KEY = process.env.FMP_API_KEY || 'your_api_key_here';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Optimized rate limiting configuration for 750 calls/minute
const RATE_CONFIG = {
  initialConcurrency: 25,       // Start with higher concurrency (up from 5-15)
  minConcurrency: 5,            // Minimum concurrency (up from 1)
  maxConcurrency: 60,           // Maximum concurrency (up from 15) - allows ~720 calls/minute
  concurrencyStep: 5,           // Larger steps for faster adaptation (up from 1)
  initialBackoff: 200,          // Reduced initial backoff (down from 300ms)
  maxBackoff: 3000,             // Reduced max backoff (down from 5000ms)
  backoffFactor: 1.5,           // Same exponential backoff factor
  successThreshold: 50,         // Higher threshold for increasing concurrency (up from 20)
  rateLimitThreshold: 3,        // Lower threshold for decreasing concurrency (down from 5)
  adaptiveWindow: 60000,        // Time window for rate limit adaptation (1 minute)
  requestSpacing: 0,            // No minimum spacing between requests (down from 100ms)
  
  // Endpoint-specific rate limits
  endpointLimits: {
    // Bulk endpoints have stricter limits
    '/bulk': {
      requestsPerMinute: 6,     // Once per 10 seconds
      spacing: 10000            // 10 seconds between requests
    },
    '/profile-bulk': {
      requestsPerMinute: 1,     // Once per 60 seconds
      spacing: 60000            // 60 seconds between requests
    },
    '/etf-bulk': {
      requestsPerMinute: 1,     // Once per 60 seconds
      spacing: 60000            // 60 seconds between requests
    },
    // Default for all other endpoints
    'default': {
      requestsPerMinute: 750,   // 750 calls per minute
      spacing: 0                // No minimum spacing
    }
  }
};

// Global state for adaptive rate limiting
let currentConcurrency = RATE_CONFIG.initialConcurrency;
let currentBackoff = RATE_CONFIG.initialBackoff;
let consecutiveSuccesses = 0;
let consecutiveRateLimits = 0;
let lastRateLimitTime = 0;
let requestsInWindow = 0;
let windowStartTime = Date.now();

// Endpoint-specific tracking
const endpointTracking = {};

// Global counters for monitoring
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;

/**
 * Get rate limit configuration for a specific endpoint
 * @param {String} endpoint - API endpoint
 * @returns {Object} Rate limit configuration
 */
function getEndpointRateLimit(endpoint) {
  // Check for exact match
  if (RATE_CONFIG.endpointLimits[endpoint]) {
    return RATE_CONFIG.endpointLimits[endpoint];
  }
  
  // Check for bulk endpoints
  if (endpoint.includes('bulk')) {
    return RATE_CONFIG.endpointLimits['/bulk'];
  }
  
  // Default rate limit
  return RATE_CONFIG.endpointLimits.default;
}

/**
 * Initialize tracking for an endpoint
 * @param {String} endpoint - API endpoint
 */
function initEndpointTracking(endpoint) {
  if (!endpointTracking[endpoint]) {
    endpointTracking[endpoint] = {
      lastRequestTime: 0,
      requestsInMinute: 0,
      minuteStartTime: Date.now()
    };
  }
  
  // Reset minute counter if needed
  const now = Date.now();
  if (now - endpointTracking[endpoint].minuteStartTime > 60000) {
    endpointTracking[endpoint].requestsInMinute = 0;
    endpointTracking[endpoint].minuteStartTime = now;
  }
}

/**
 * Check if an endpoint request should be throttled
 * @param {String} endpoint - API endpoint
 * @returns {Boolean} Whether request should be throttled
 */
function shouldThrottleEndpoint(endpoint) {
  const tracking = endpointTracking[endpoint];
  const limits = getEndpointRateLimit(endpoint);
  
  // Check if we've exceeded requests per minute
  if (tracking.requestsInMinute >= limits.requestsPerMinute) {
    return true;
  }
  
  // Check if we need to enforce spacing
  const now = Date.now();
  if (limits.spacing > 0 && now - tracking.lastRequestTime < limits.spacing) {
    return true;
  }
  
  return false;
}

/**
 * Update endpoint tracking after a request
 * @param {String} endpoint - API endpoint
 */
function updateEndpointTracking(endpoint) {
  const tracking = endpointTracking[endpoint];
  tracking.lastRequestTime = Date.now();
  tracking.requestsInMinute++;
}

/**
 * Make API request with optimized rate limiting
 * @param {String} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise} Promise resolving to API response
 */
async function makeApiRequest(endpoint, params = {}) {
  // Initialize endpoint tracking
  initEndpointTracking(endpoint);
  
  // Check if we should throttle this endpoint
  if (shouldThrottleEndpoint(endpoint)) {
    const limits = getEndpointRateLimit(endpoint);
    const delay = Math.max(
      limits.spacing - (Date.now() - endpointTracking[endpoint].lastRequestTime),
      60000 - (Date.now() - endpointTracking[endpoint].minuteStartTime)
    );
    
    console.log(`Throttling endpoint ${endpoint} for ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Add API key to params
  params.apikey = API_KEY;
  
  // Update request timing
  updateEndpointTracking(endpoint);
  totalRequests++;
  
  // Update window counters
  const now = Date.now();
  if (now - windowStartTime > RATE_CONFIG.adaptiveWindow) {
    // Reset window
    windowStartTime = now;
    requestsInWindow = 0;
  }
  requestsInWindow++;
  
  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await axios.get(url, { params });
    
    // Handle successful request
    successfulRequests++;
    consecutiveSuccesses++;
    consecutiveRateLimits = 0;
    
    // Potentially increase concurrency if we've had enough consecutive successes
    if (consecutiveSuccesses >= RATE_CONFIG.successThreshold && 
        currentConcurrency < RATE_CONFIG.maxConcurrency) {
      currentConcurrency = Math.min(
        currentConcurrency + RATE_CONFIG.concurrencyStep,
        RATE_CONFIG.maxConcurrency
      );
      consecutiveSuccesses = 0;
      console.log(`[ADAPTIVE] Increased concurrency to ${currentConcurrency}`);
    }
    
    return response.data;
  } catch (error) {
    // Handle rate limiting
    if (error.response && (error.response.status === 429 || error.response.status === 403)) {
      rateLimitedRequests++;
      consecutiveRateLimits++;
      consecutiveSuccesses = 0;
      lastRateLimitTime = Date.now();
      
      // Decrease concurrency if we're getting rate limited
      if (consecutiveRateLimits >= RATE_CONFIG.rateLimitThreshold && 
          currentConcurrency > RATE_CONFIG.minConcurrency) {
        currentConcurrency = Math.max(
          currentConcurrency - RATE_CONFIG.concurrencyStep,
          RATE_CONFIG.minConcurrency
        );
        consecutiveRateLimits = 0;
        console.log(`[ADAPTIVE] Decreased concurrency to ${currentConcurrency}`);
      }
      
      // Increase backoff time
      currentBackoff = Math.min(
        currentBackoff * RATE_CONFIG.backoffFactor,
        RATE_CONFIG.maxBackoff
      );
      
      console.log(`[API] Rate limited. Backing off for ${currentBackoff}ms`);
      await new Promise(resolve => setTimeout(resolve, currentBackoff));
      
      // Retry the request
      return makeApiRequest(endpoint, params);
    }
    
    // Handle other errors
    failedRequests++;
    console.error(`[ERROR] makeApiRequest: ${error.message}`);
    throw error;
  }
}

/**
 * Process stock data with custom Debt/EBITDA calculation
 * @param {Object} stockInfo - Basic stock info
 * @param {Object} profile - Company profile
 * @param {Object} quote - Company quote
 * @param {Object} ratios - Financial ratios
 * @param {Object} financials - Financial statements
 * @returns {Object} Processed stock data
 */
function processStockData(stockInfo, profile, quote, ratios, financials) {
  // Create base stock object
  const stock = {
    symbol: stockInfo.symbol,
    name: stockInfo.name || profile?.companyName || '',
    exchange: stockInfo.exchange || profile?.exchangeShortName || '',
    sector: profile?.sector || '',
    industry: profile?.industry || '',
    price: quote?.price || 0,
    marketCap: quote?.marketCap || 0,
    avgDollarVolume: quote?.avgVolume ? quote.avgVolume * (quote.price || 0) : 0,
    lastUpdated: new Date()
  };
  
  // Add financial metrics
  if (ratios) {
    // Check if Debt/EBITDA is directly available from API
    if (ratios.debtToEBITDA || ratios.netDebtToEBITDA) {
      stock.netDebtToEBITDA = ratios.debtToEBITDA || ratios.netDebtToEBITDA;
      stock.netDebtToEBITDACalculated = false;
    } else if (financials) {
      // Calculate from components if direct value not available
      const calculationResult = debtEBITDACalculator.calculateDebtToEBITDA(financials);
      
      if (calculationResult.hasAllComponents && calculationResult.value !== null) {
        stock.netDebtToEBITDA = calculationResult.value;
        stock.netDebtToEBITDACalculated = true;
        stock.netDebtToEBITDAMethod = calculationResult.method;
      } else {
        stock.netDebtToEBITDA = null;
      }
    }
    
    stock.peRatio = ratios.priceEarningsRatio || 0;
    stock.dividendYield = ratios.dividendYield || 0;
  }
  
  // Add other metrics
  if (financials) {
    stock.evToEBIT = financials.enterpriseValueOverEBIT || 0;
    stock.rotce = financials.returnOnTangibleAssets || 0;
  }
  
  // Calculate score
  stock.score = calculateScore(stock);
  
  return stock;
}

/**
 * Calculate stock score based on various metrics
 * @param {Object} stock - Stock data
 * @returns {Number} Score from 0-100
 */
function calculateScore(stock) {
  // Implement your scoring logic here
  return 50; // Placeholder
}

/**
 * Import stock data for a single symbol with optimized API usage
 * @param {Object} stockInfo - Basic stock info
 * @returns {Promise<Object>} Promise resolving to imported stock data
 */
async function importStock(stockInfo) {
  try {
    const symbol = stockInfo.symbol;
    console.log(`Importing data for ${symbol}...`);
    
    // Make parallel requests for different data types
    const [profile, quote, ratios, financials] = await Promise.all([
      makeApiRequest(`/profile/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/quote/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/ratios/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/income-statement/${symbol}?limit=1`).then(data => data && data.length > 0 ? data[0] : null)
    ]);
    
    // Process and combine data
    const stockData = processStockData(stockInfo, profile, quote, ratios, financials);
    
    // Return processed data
    return stockData;
  } catch (error) {
    console.error(`Error importing ${stockInfo.symbol}:`, error);
    return null;
  }
}

/**
 * Import all stocks with optimized parallel processing
 * @param {Array} stocks - Array of stock info objects
 * @param {Function} saveCallback - Function to save stock data
 * @param {Function} progressCallback - Function to report progress
 * @returns {Promise} Promise resolving when import is complete
 */
async function importAllStocksOptimized(stocks, saveCallback, progressCallback) {
  try {
    console.log(`Starting optimized import of ${stocks.length} stocks with concurrency ${currentConcurrency}`);
    
    // Process stocks in batches with adaptive concurrency
    let completed = 0;
    let failed = 0;
    
    // Process in batches
    for (let i = 0; i < stocks.length; i += currentConcurrency) {
      const batch = stocks.slice(i, i + currentConcurrency);
      
      // Process batch concurrently
      const results = await Promise.allSettled(batch.map(stock => importStock(stock)));
      
      // Process and save results
      const successfulStocks = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          completed++;
          successfulStocks.push(result.value);
        } else {
          failed++;
        }
      });
      
      // Save successful stocks in bulk if possible
      if (successfulStocks.length > 0 && saveCallback) {
        await saveCallback(successfulStocks);
      }
      
      // Report progress
      if (progressCallback) {
        progressCallback({
          total: stocks.length,
          completed,
          failed,
          remaining: stocks.length - (completed + failed),
          currentConcurrency
        });
      }
      
      // Log progress
      console.log(`Progress: ${completed + failed}/${stocks.length} (${completed} succeeded, ${failed} failed)`);
      
      // Adaptive delay between batches based on current rate limiting status
      if (lastRateLimitTime > Date.now() - 5000) {
        // If we've been rate limited recently, add a small delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('Import completed successfully');
    console.log(`Imported ${completed} stocks, ${failed} failed`);
    
    return {
      total: stocks.length,
      completed,
      failed
    };
  } catch (error) {
    console.error(`[API] importAllStocksOptimized: ${error.message}`);
    throw error;
  }
}

// Export functions
module.exports = {
  makeApiRequest,
  importStock,
  importAllStocksOptimized,
  processStockData,
  RATE_CONFIG
};
