/**
 * Financial Modeling Prep API Import Module
 * Replaces Polygon.io with FMP for stock data import
 * Modified for Heroku compatibility
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const errorLogger = require('./errorLogger');

// Load Stock model
const Stock = require('./db/models/Stock');

// API configuration
const API_KEY = 'nVR1WhOPm2A0hL8yjk8sVahVjiw9TB5l'; // FMP API key
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Import status constants
const IMPORT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited'
};

// Adaptive rate limiting configuration
const RATE_CONFIG = {
  initialConcurrency: 5,        // Start with conservative concurrency
  minConcurrency: 1,            // Minimum concurrency
  maxConcurrency: 15,           // Maximum concurrency
  concurrencyStep: 1,           // How much to adjust concurrency
  initialBackoff: 300,          // Initial backoff in ms
  maxBackoff: 5000,             // Maximum backoff in ms
  backoffFactor: 1.5,           // Exponential backoff factor
  successThreshold: 20,         // Number of consecutive successes to increase concurrency
  rateLimitThreshold: 5,        // Number of rate limits to decrease concurrency
  adaptiveWindow: 60000,        // Time window for rate limit adaptation (1 minute)
  requestSpacing: 100           // Minimum ms between requests
};

// Global state for adaptive rate limiting
let currentConcurrency = RATE_CONFIG.initialConcurrency;
let currentBackoff = RATE_CONFIG.initialBackoff;
let consecutiveSuccesses = 0;
let consecutiveRateLimits = 0;
let lastRateLimitTime = 0;
let requestsInWindow = 0;
let windowStartTime = Date.now();
let lastRequestTime = 0;

// Global counters for monitoring
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;

// Use /tmp directory for Heroku compatibility
const dataDir = '/tmp';

/**
 * Update import status - safe for Heroku
 * @param {Object} status - Status object to save
 */
function updateImportStatus(status) {
  try {
    // On Heroku, just log the status instead of writing to file
    console.log('Import Status Update:', JSON.stringify(status));
    
    // Try to write to tmp directory (which is writable on Heroku)
    try {
      const importStatusPath = path.join(dataDir, 'import_status.json');
      fs.writeFileSync(importStatusPath, JSON.stringify(status, null, 2));
    } catch (writeError) {
      // Silently fail if writing fails - this is just status tracking
      console.log('Note: Could not write status file (expected on Heroku)');
    }
  } catch (error) {
    console.error('Error updating import status:', error);
  }
}

/**
 * Get current import status - safe for Heroku
 * @returns {Object} Current import status
 */
function getImportStatus() {
  try {
    const importStatusPath = path.join(dataDir, 'import_status.json');
    if (fs.existsSync(importStatusPath)) {
      return JSON.parse(fs.readFileSync(importStatusPath, 'utf8'));
    }
  } catch (error) {
    // Silently fail if reading fails - this is just status tracking
    console.log('Note: Could not read status file (expected on Heroku)');
  }
  
  return {
    status: IMPORT_STATUS.IDLE,
    lastRun: null,
    progress: {
      total: 0,
      completed: 0,
      failed: 0
    }
  };
}

/**
 * Make API request with adaptive rate limiting
 * @param {String} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise} Promise resolving to API response
 */
async function makeApiRequest(endpoint, params = {}) {
  // Add API key to params
  params.apikey = API_KEY;
  
  // Enforce minimum spacing between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_CONFIG.requestSpacing) {
    await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.requestSpacing - timeSinceLastRequest));
  }
  
  // Update request timing
  lastRequestTime = Date.now();
  totalRequests++;
  
  // Update window counters
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
 * Get all stock symbols from FMP API
 * @returns {Promise<Array>} Promise resolving to array of stock symbols
 */
async function getAllStockSymbols() {
  try {
    console.log('Starting getAllStockSymbols function with adaptive rate limiting');
    
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
    
    return commonStocks.map(stock => ({
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
 * Get company profile from FMP API
 * @param {String} symbol - Stock symbol
 * @returns {Promise<Object>} Promise resolving to company profile
 */
async function getCompanyProfile(symbol) {
  try {
    const profiles = await makeApiRequest(`/profile/${symbol}`);
    return profiles && profiles.length > 0 ? profiles[0] : null;
  } catch (error) {
    console.error(`[API] getCompanyProfile for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Get company quote from FMP API
 * @param {String} symbol - Stock symbol
 * @returns {Promise<Object>} Promise resolving to company quote
 */
async function getCompanyQuote(symbol) {
  try {
    const quotes = await makeApiRequest(`/quote/${symbol}`);
    return quotes && quotes.length > 0 ? quotes[0] : null;
  } catch (error) {
    console.error(`[API] getCompanyQuote for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Get company financial ratios from FMP API
 * @param {String} symbol - Stock symbol
 * @returns {Promise<Object>} Promise resolving to financial ratios
 */
async function getFinancialRatios(symbol) {
  try {
    const ratios = await makeApiRequest(`/ratios/${symbol}`);
    return ratios && ratios.length > 0 ? ratios[0] : null;
  } catch (error) {
    console.error(`[API] getFinancialRatios for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Get company key metrics from FMP API
 * @param {String} symbol - Stock symbol
 * @returns {Promise<Object>} Promise resolving to key metrics
 */
async function getKeyMetrics(symbol) {
  try {
    const metrics = await makeApiRequest(`/key-metrics/${symbol}`);
    return metrics && metrics.length > 0 ? metrics[0] : null;
  } catch (error) {
    console.error(`[API] getKeyMetrics for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Calculate stock score based on various metrics
 * @param {Object} stockData - Combined stock data
 * @returns {Number} Score from 0-100
 */
function calculateScore(stockData) {
  let score = 0;
  
  // Market cap score (0-20)
  const marketCap = stockData.marketCap || 0;
  if (marketCap > 10000000000) score += 20; // $10B+
  else if (marketCap > 2000000000) score += 15; // $2B+
  else if (marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  const debtToEBITDA = stockData.netDebtToEBITDA || 0;
  if (debtToEBITDA < 1) score += 20;
  else if (debtToEBITDA < 2) score += 15;
  else if (debtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  const peRatio = stockData.peRatio || 0;
  if (peRatio > 0 && peRatio < 15) score += 20;
  else if (peRatio > 0 && peRatio < 25) score += 15;
  else if (peRatio > 0 && peRatio < 35) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  const rotce = stockData.rotce || 0;
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
 * Process stock data from FMP API and map to our schema
 * @param {Object} stockInfo - Basic stock info
 * @param {Object} profile - Company profile
 * @param {Object} quote - Company quote
 * @param {Object} ratios - Financial ratios
 * @param {Object} metrics - Key metrics
 * @returns {Object} Processed stock data
 */
function processStockData(stockInfo, profile, quote, ratios, metrics) {
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
    stock.netDebtToEBITDA = ratios.debtToEBITDA || 0;
    stock.peRatio = ratios.priceEarningsRatio || 0;
    stock.dividendYield = ratios.dividendYield || 0;
  }
  
  if (metrics) {
    stock.evToEBIT = metrics.enterpriseValueOverEBIT || 0;
    stock.rotce = metrics.returnOnTangibleAssets || 0;
  }
  
  // Calculate score
  stock.score = calculateScore(stock);
  
  return stock;
}

/**
 * Import stock data for a single symbol
 * @param {Object} stockInfo - Basic stock info
 * @returns {Promise<Object>} Promise resolving to imported stock data
 */
async function importStock(stockInfo) {
  try {
    const symbol = stockInfo.symbol;
    console.log(`Importing data for ${symbol}...`);
    
    // Get company profile
    const profile = await getCompanyProfile(symbol);
    
    // Get company quote
    const quote = await getCompanyQuote(symbol);
    
    // Get financial ratios
    const ratios = await getFinancialRatios(symbol);
    
    // Get key metrics
    const metrics = await getKeyMetrics(symbol);
    
    // Process and combine data
    const stockData = processStockData(stockInfo, profile, quote, ratios, metrics);
    
    // Save to database
    await Stock.findOneAndUpdate(
      { symbol: stockData.symbol },
      stockData,
      { upsert: true, new: true }
    );
    
    return stockData;
  } catch (error) {
    console.error(`Error importing ${stockInfo.symbol}:`, error);
    errorLogger.logError(`Import error for ${stockInfo.symbol}`, error);
    return null;
  }
}

/**
 * Import all stocks with adaptive rate limiting
 * @returns {Promise} Promise resolving when import is complete
 */
async function importAllStocksAdaptive() {
  try {
    console.log('Starting adaptive import of all stocks');
    
    // Update import status
    updateImportStatus({
      status: IMPORT_STATUS.RUNNING,
      startTime: new Date(),
      progress: {
        total: 0,
        completed: 0,
        failed: 0
      }
    });
    
    // Get all stock symbols
    console.log('Getting all tickers...');
    const stocks = await getAllStockSymbols();
    
    // Update import status with total count
    updateImportStatus({
      status: IMPORT_STATUS.RUNNING,
      startTime: new Date(),
      progress: {
        total: stocks.length,
        completed: 0,
        failed: 0
      }
    });
    
    // Process stocks in batches with adaptive concurrency
    let completed = 0;
    let failed = 0;
    
    // Process in batches
    for (let i = 0; i < stocks.length; i += currentConcurrency) {
      const batch = stocks.slice(i, i + currentConcurrency);
      
      // Process batch concurrently
      const results = await Promise.allSettled(batch.map(stock => importStock(stock)));
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          completed++;
        } else {
          failed++;
        }
      });
      
      // Update progress
      const progress = {
        total: stocks.length,
        completed,
        failed
      };
      
      // Log progress
      console.log(`Progress: ${completed + failed}/${stocks.length} (${completed} succeeded, ${failed} failed)`);
      
      // Update import status
      updateImportStatus({
        status: IMPORT_STATUS.RUNNING,
        startTime: new Date(),
        progress
      });
      
      // Adaptive delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update import status to completed
    updateImportStatus({
      status: IMPORT_STATUS.COMPLETED,
      startTime: new Date(),
      endTime: new Date(),
      progress: {
        total: stocks.length,
        completed,
        failed
      }
    });
    
    console.log('Import completed successfully');
    console.log(`Imported ${completed} stocks, ${failed} failed`);
    
    return {
      total: stocks.length,
      completed,
      failed
    };
  } catch (error) {
    console.error(`[API] importAllStocksAdaptive: ${error.message}`);
    
    // Update import status to error
    updateImportStatus({
      status: IMPORT_STATUS.ERROR,
      startTime: new Date(),
      endTime: new Date(),
      error: error.message
    });
    
    throw error;
  }
}

// Export functions
module.exports = {
  importAllStocksAdaptive,
  getImportStatus,
  makeApiRequest,
  updateImportStatus
};
