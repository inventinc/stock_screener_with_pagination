/**
 * Heroku-Optimized FMP API Import Strategy - 750 API Calls Per Minute Edition
 * Designed for Heroku deployment with maximum API throughput
 * 
 * Features:
 * - Optimized for 750 API calls per minute
 * - Enhanced concurrency settings for maximum throughput
 * - Timeout handling for 30-minute dyno limit
 * - Memory-efficient processing
 * - Custom Debt/EBITDA calculation integration
 * - Comprehensive error handling and retry logic
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Import custom Debt/EBITDA calculator
// Make sure to upload this file to your Heroku app
const debtEBITDACalculator = require('./custom_debt_ebitda_calculator');

// API configuration
const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

// Import timeout (Heroku has 30 min limit)
const IMPORT_TIMEOUT = 25 * 60 * 1000; // 25 minutes

// Optimized rate limiting configuration for 750 calls/minute
const RATE_CONFIG = {
  initialConcurrency: 30,       // Increased from 15 for higher throughput
  minConcurrency: 10,           // Increased from 5 for higher throughput
  maxConcurrency: 60,           // Doubled from 30 for maximum throughput
  concurrencyStep: 5,           // Increased from 3 for faster adaptation
  initialBackoff: 100,          // Reduced from 200ms for faster recovery
  maxBackoff: 2000,             // Reduced from 3000ms for faster recovery
  backoffFactor: 1.3,           // Reduced from 1.5 for faster recovery
  successThreshold: 20,         // Reduced from 30 for faster upscaling
  rateLimitThreshold: 3,        // Increased from 2 for more tolerance
  adaptiveWindow: 30000,        // Reduced from 60000ms for faster adaptation
  requestSpacing: 0,            // No minimum spacing between requests
  
  // Target API call rate
  targetRequestsPerMinute: 750, // 750 calls per minute (12.5 calls per second)
  
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
    // Default for all other endpoints - maximized to 750/minute
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

// Rate monitoring
let minuteStartTime = Date.now();
let requestsThisMinute = 0;
let minuteCounter = 1;

// Endpoint-specific tracking
const endpointTracking = {};

// Global counters for monitoring
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;

// Import status tracking
let importStatus = {
  status: 'idle',
  startTime: null,
  endTime: null,
  progress: {
    total: 0,
    completed: 0,
    failed: 0
  }
};

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
 * Update and log global rate statistics
 */
function updateRateStatistics() {
  const now = Date.now();
  requestsThisMinute++;
  
  // If a minute has passed, log the rate and reset
  if (now - minuteStartTime >= 60000) {
    const elapsedSeconds = (now - minuteStartTime) / 1000;
    const rate = requestsThisMinute / elapsedSeconds * 60;
    
    console.log(`[RATE] Minute ${minuteCounter}: ${requestsThisMinute} requests (${rate.toFixed(2)}/min)`);
    
    // Reset counters
    minuteStartTime = now;
    requestsThisMinute = 0;
    minuteCounter++;
  }
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
  updateRateStatistics();
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
    const response = await axios.get(url, { 
      params,
      timeout: 10000 // 10 second timeout (reduced from default)
    });
    
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
  let score = 0;
  
  // Market cap score (0-20)
  const marketCap = stock.marketCap || 0;
  if (marketCap > 10000000000) score += 20; // $10B+
  else if (marketCap > 2000000000) score += 15; // $2B+
  else if (marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  const debtToEBITDA = stock.netDebtToEBITDA || 0;
  if (debtToEBITDA < 1) score += 20;
  else if (debtToEBITDA < 2) score += 15;
  else if (debtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  const peRatio = stock.peRatio || 0;
  if (peRatio > 0 && peRatio < 15) score += 20;
  else if (peRatio > 0 && peRatio < 25) score += 15;
  else if (peRatio > 0 && peRatio < 35) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  const rotce = stock.rotce || 0;
  if (rotce > 0.2) score += 20;
  else if (rotce > 0.15) score += 15;
  else if (rotce > 0.1) score += 10;
  else score += 5;
  
  // Add random factor (0-20) for demonstration
  score += Math.floor(Math.random() * 20);
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Get all stock symbols from FMP API
 * @returns {Promise<Array>} Promise resolving to array of stock symbols
 */
async function getAllStockSymbols() {
  try {
    console.log('Starting getAllStockSymbols function with optimized rate limiting');
    
    // Get all stock symbols from FMP API
    console.log('Making API request to get all stock symbols...');
    const stockList = await makeApiRequest('/stock/list');
    
    if (!stockList || !Array.isArray(stockList)) {
      throw new Error('Invalid response from FMP API');
    }
    
    // Filter to only include common stocks (exclude ETFs, etc.)
    const commonStocks = stockList.filter(stock => 
      stock.type === 'stock' && 
      (stock.exchangeShortName === 'NYSE' || stock.exchangeShortName === 'NASDAQ')
    );
    
    console.log(`Found ${commonStocks.length} common stocks on NYSE and NASDAQ`);
    
    // For Heroku, limit to a reasonable number to avoid timeouts
    // Increased from 100 to 200 for higher throughput
    const limitedStocks = commonStocks.slice(0, 200);
    console.log(`Limited to ${limitedStocks.length} stocks for Heroku compatibility`);
    
    return limitedStocks.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchangeShortName
    }));
  } catch (error) {
    console.error(`[API] getAllStockSymbols: ${error.message}`);
    throw error;
  }
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
    
    // Update import status
    importStatus = {
      status: 'running',
      startTime: new Date(),
      progress: {
        total: stocks.length,
        completed: 0,
        failed: 0
      }
    };
    
    // Process stocks in batches with adaptive concurrency
    let completed = 0;
    let failed = 0;
    
    // Process in batches
    for (let i = 0; i < stocks.length; i += currentConcurrency) {
      // Check if we're approaching timeout
      if (Date.now() - importStatus.startTime > IMPORT_TIMEOUT) {
        console.log('Import timeout approaching, stopping gracefully');
        break;
      }
      
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
      
      // Update progress
      importStatus.progress = {
        total: stocks.length,
        completed,
        failed,
        remaining: stocks.length - (completed + failed)
      };
      
      // Report progress
      if (progressCallback) {
        progressCallback(importStatus.progress);
      }
      
      // Log progress
      console.log(`Progress: ${completed + failed}/${stocks.length} (${completed} succeeded, ${failed} failed)`);
      
      // No delay between batches to maximize throughput
      // Only add a small delay if we've been rate limited recently
      if (lastRateLimitTime > Date.now() - 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Update import status
    importStatus = {
      status: 'completed',
      startTime: importStatus.startTime,
      endTime: new Date(),
      progress: {
        total: stocks.length,
        completed,
        failed,
        remaining: stocks.length - (completed + failed)
      }
    };
    
    console.log('Import completed successfully');
    console.log(`Imported ${completed} stocks, ${failed} failed`);
    
    return {
      total: stocks.length,
      completed,
      failed
    };
  } catch (error) {
    console.error(`[API] importAllStocksOptimized: ${error.message}`);
    
    // Update import status
    importStatus = {
      status: 'error',
      startTime: importStatus.startTime,
      endTime: new Date(),
      error: error.message,
      progress: importStatus.progress
    };
    
    throw error;
  }
}

/**
 * Save stock data to MongoDB
 * @param {Array} stocks - Array of stock data objects
 * @returns {Promise} Promise resolving when save is complete
 */
async function saveStocksToDB(stocks) {
  try {
    // Get Stock model
    const Stock = mongoose.model('Stock');
    
    // Use bulkWrite for better performance
    const bulkOps = stocks.map(stock => ({
      updateOne: {
        filter: { symbol: stock.symbol },
        update: { $set: stock },
        upsert: true
      }
    }));
    
    // Execute bulk operation
    await Stock.bulkWrite(bulkOps);
    
    return true;
  } catch (error) {
    console.error(`[DB] Error saving stocks to database: ${error.message}`);
    throw error;
  }
}

/**
 * Test API call rate to verify 750 calls per minute capability
 * @param {Number} duration - Test duration in seconds
 * @returns {Promise} Promise resolving when test is complete
 */
async function testApiCallRate(duration = 60) {
  console.log(`Starting API call rate test for ${duration} seconds...`);
  
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  let callCount = 0;
  let successCount = 0;
  let failCount = 0;
  
  // Reset rate monitoring
  minuteStartTime = Date.now();
  requestsThisMinute = 0;
  minuteCounter = 1;
  
  // Create a simple endpoint that returns quickly
  const testEndpoint = '/quote/AAPL';
  
  // Make concurrent requests to maximize throughput
  const concurrency = 30;
  
  while (Date.now() < endTime) {
    const promises = [];
    
    // Launch concurrent requests
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        makeApiRequest(testEndpoint)
          .then(() => { successCount++; })
          .catch(() => { failCount++; })
          .finally(() => { callCount++; })
      );
    }
    
    // Wait for all requests to complete
    await Promise.allSettled(promises);
    
    // Brief pause to allow for rate monitoring
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const actualDuration = (Date.now() - startTime) / 1000;
  const callsPerMinute = (callCount / actualDuration) * 60;
  
  console.log(`Test completed in ${actualDuration.toFixed(2)} seconds`);
  console.log(`Total API calls: ${callCount} (${successCount} success, ${failCount} fail)`);
  console.log(`Rate: ${callsPerMinute.toFixed(2)} calls per minute`);
  
  return {
    duration: actualDuration,
    totalCalls: callCount,
    successCalls: successCount,
    failCalls: failCount,
    callsPerMinute: callsPerMinute
  };
}

/**
 * Main function to run the import process
 */
async function runImport() {
  try {
    console.log('Starting optimized FMP import process (750 calls/minute)...');
    
    // Connect to MongoDB
    console.log(`Connecting to MongoDB at ${MONGODB_URI || 'mongodb://localhost:27017/stocksDB'}...`);
    await mongoose.connect(MONGODB_URI || 'mongodb://localhost:27017/stocksDB');
    console.log('Connected to MongoDB');
    
    // Ensure Stock model is defined
    if (!mongoose.models.Stock) {
      const stockSchema = new mongoose.Schema({
        symbol: { type: String, required: true, unique: true },
        name: String,
        exchange: String,
        sector: String,
        industry: String,
        price: Number,
        marketCap: Number,
        avgDollarVolume: Number,
        netDebtToEBITDA: Number,
        evToEBIT: Number,
        rotce: Number,
        peRatio: Number,
        dividendYield: Number,
        score: Number,
        lastUpdated: Date
      });
      
      mongoose.model('Stock', stockSchema);
    }
    
    // Get all stock symbols
    console.log('Getting all stock symbols...');
    const stocks = await getAllStockSymbols();
    
    // Import all stocks
    console.log(`Starting import of ${stocks.length} stocks...`);
    const result = await importAllStocksOptimized(
      stocks,
      saveStocksToDB,
      progress => console.log(`Progress update: ${progress.completed}/${progress.total} stocks processed`)
    );
    
    console.log('Import completed with results:', result);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    return result;
  } catch (error) {
    console.error('Error in import process:', error);
    
    // Ensure MongoDB connection is closed
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB due to error');
    }
    
    throw error;
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  // Check if we should run a rate test first
  if (process.argv.includes('--test-rate')) {
    console.log('Running API rate test...');
    testApiCallRate(60)
      .then(result => {
        console.log('Rate test completed:', result);
        
        if (result.callsPerMinute >= 700) {
          console.log('Rate test successful! Proceeding with import...');
          return runImport();
        } else {
          console.log('Rate test failed to achieve target rate. Please check API key and network conditions.');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('Error in rate test:', error);
        process.exit(1);
      });
  } else {
    // Run the import directly
    runImport()
      .then(() => {
        console.log('Import process completed successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('Import process failed:', error);
        process.exit(1);
      });
  }
}

// Export functions for testing or external use
module.exports = {
  importAllStocksOptimized,
  testApiCallRate,
  runImport
};
