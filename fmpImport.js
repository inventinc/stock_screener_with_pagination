/**
 * Enhanced FMP API Import Strategy
 * Comprehensive version with complete field coverage and improved data quality
 * 
 * Features:
 * - Complete field coverage including all required metrics
 * - Data validation and quality checks
 * - Prioritization and incremental update strategy
 * - Enhanced error handling and reporting
 * - Optimized for Heroku deployment
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Import custom Debt/EBITDA calculator
const debtEBITDACalculator = require('./custom_debt_ebitda_calculator');

// API configuration
const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

// Import timeout (Heroku has 30 min limit)
const IMPORT_TIMEOUT = 25 * 60 * 1000; // 25 minutes

// Enhanced rate limiting configuration
const RATE_CONFIG = {
  initialConcurrency: 30,       // Start with moderate concurrency
  minConcurrency: 10,           // Minimum concurrency
  maxConcurrency: 60,           // Maximum concurrency
  concurrencyStep: 5,           // How much to adjust concurrency
  initialBackoff: 100,          // Initial backoff in ms
  maxBackoff: 2000,             // Maximum backoff in ms
  backoffFactor: 1.3,           // Exponential backoff factor
  successThreshold: 20,         // Number of consecutive successes to increase concurrency
  rateLimitThreshold: 3,        // Number of rate limits to decrease concurrency
  adaptiveWindow: 30000,        // Time window for rate limit adaptation
  requestSpacing: 0,            // No minimum spacing between requests
  
  // Target API call rate
  targetRequestsPerMinute: 750, // 750 calls per minute
  
  // Endpoint-specific rate limits
  endpointLimits: {
    // Bulk endpoints have stricter limits
    '/bulk': {
      requestsPerMinute: 6,
      spacing: 10000
    },
    '/profile-bulk': {
      requestsPerMinute: 1,
      spacing: 60000
    },
    '/etf-bulk': {
      requestsPerMinute: 1,
      spacing: 60000
    },
    // Default for all other endpoints
    'default': {
      requestsPerMinute: 750,
      spacing: 0
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
  },
  dataQuality: {
    missingFields: {},
    validationIssues: {},
    completenessScore: 100
  }
};

// Priority queue for stock imports
let priorityQueue = [];

// Stock rotation tracking
let stockRotationIndex = 0;
const ROTATION_BATCH_SIZE = 200; // Process 200 stocks per run

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
      timeout: 10000 // 10 second timeout
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
 * Validate a numeric field
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateNumericField(value, options = {}) {
  const result = {
    value: value,
    isValid: true,
    issues: []
  };
  
  // Check if value is null or undefined
  if (value === null || value === undefined) {
    result.isValid = false;
    result.issues.push('missing');
    return result;
  }
  
  // Check if value is a number
  if (typeof value !== 'number' || isNaN(value)) {
    result.isValid = false;
    result.issues.push('not_a_number');
    return result;
  }
  
  // Check minimum value
  if (options.min !== undefined && value < options.min) {
    result.isValid = false;
    result.issues.push('below_minimum');
  }
  
  // Check maximum value
  if (options.max !== undefined && value > options.max) {
    result.isValid = false;
    result.issues.push('above_maximum');
  }
  
  // Check for zero when it might be a placeholder
  if (options.zeroIsInvalid && value === 0) {
    result.isValid = false;
    result.issues.push('zero_value');
  }
  
  // Check for negative when it should be positive
  if (options.shouldBePositive && value < 0) {
    result.isValid = false;
    result.issues.push('negative_value');
  }
  
  return result;
}

/**
 * Process stock data with enhanced field coverage and validation
 * @param {Object} stockInfo - Basic stock info
 * @param {Object} profile - Company profile
 * @param {Object} quote - Company quote
 * @param {Object} ratios - Financial ratios
 * @param {Object} financials - Financial statements
 * @param {Object} keyMetrics - Key metrics
 * @param {Object} growth - Growth metrics
 * @returns {Object} Processed stock data with validation
 */
function processStockData(stockInfo, profile, quote, ratios, financials, keyMetrics, growth) {
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
    lastUpdated: new Date(),
    dataQuality: {
      missingFields: [],
      validationIssues: {}
    }
  };
  
  // Add financial metrics with validation
  if (ratios) {
    // Debt/EBITDA ratio
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
        stock.dataQuality.missingFields.push('netDebtToEBITDA');
      }
    } else {
      stock.netDebtToEBITDA = null;
      stock.dataQuality.missingFields.push('netDebtToEBITDA');
    }
    
    // PE Ratio
    stock.peRatio = ratios.priceEarningsRatio || 0;
    if (stock.peRatio === 0) {
      stock.dataQuality.missingFields.push('peRatio');
    }
    
    // Dividend Yield
    stock.dividendYield = ratios.dividendYield || 0;
    
    // Price to Book - ADDED FIELD
    stock.priceToBook = ratios.priceToBookRatio || 0;
    if (stock.priceToBook === 0) {
      stock.dataQuality.missingFields.push('priceToBook');
    }
  } else {
    stock.dataQuality.missingFields.push('ratios');
  }
  
  // Add other metrics from financials
  if (financials) {
    stock.evToEBIT = financials.enterpriseValueOverEBIT || 0;
    stock.rotce = financials.returnOnTangibleAssets || 0;
    
    // FCF to Net Income - ADDED FIELD
    if (financials.freeCashFlow && financials.netIncome && financials.netIncome !== 0) {
      stock.fcfToNetIncome = financials.freeCashFlow / financials.netIncome;
    } else {
      stock.fcfToNetIncome = 0;
      stock.dataQuality.missingFields.push('fcfToNetIncome');
    }
  } else {
    stock.dataQuality.missingFields.push('financials');
  }
  
  // Add growth metrics - ADDED FIELDS
  if (growth) {
    // Revenue Growth
    stock.revenueGrowth = growth.revenueGrowth || 0;
    if (stock.revenueGrowth === 0) {
      stock.dataQuality.missingFields.push('revenueGrowth');
    }
    
    // Share Count Growth
    stock.shareCountGrowth = growth.weightedAverageShsOutGrowth || 0;
  } else {
    stock.dataQuality.missingFields.push('growth');
  }
  
  // Add insider ownership from profile - ADDED FIELD
  if (profile) {
    stock.insiderOwnership = profile.insiderOwnership || 0;
    if (stock.insiderOwnership === 0) {
      stock.dataQuality.missingFields.push('insiderOwnership');
    }
  }
  
  // Validate key numeric fields
  const validationFields = [
    { field: 'price', options: { min: 0, zeroIsInvalid: true, shouldBePositive: true } },
    { field: 'marketCap', options: { min: 0, zeroIsInvalid: true, shouldBePositive: true } },
    { field: 'netDebtToEBITDA', options: { shouldBePositive: false } }, // Can be negative
    { field: 'peRatio', options: { shouldBePositive: true } },
    { field: 'priceToBook', options: { shouldBePositive: true } },
    { field: 'rotce', options: { shouldBePositive: true } }
  ];
  
  validationFields.forEach(({ field, options }) => {
    const validation = validateNumericField(stock[field], options);
    if (!validation.isValid) {
      stock.dataQuality.validationIssues[field] = validation.issues;
    }
  });
  
  // Calculate data quality score
  const totalFields = 12; // Total number of important fields
  const missingCount = stock.dataQuality.missingFields.length;
  const validationIssueCount = Object.keys(stock.dataQuality.validationIssues).length;
  
  stock.dataQuality.completenessScore = Math.max(0, Math.round(100 * (1 - (missingCount + validationIssueCount) / totalFields)));
  
  // Calculate stock score without random factor
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
  
  // Price to Book score (0-10) - ADDED METRIC
  const priceToBook = stock.priceToBook || 0;
  if (priceToBook > 0 && priceToBook < 1) score += 10;
  else if (priceToBook > 0 && priceToBook < 2) score += 8;
  else if (priceToBook > 0 && priceToBook < 3) score += 5;
  else score += 0;
  
  // Revenue Growth score (0-10) - ADDED METRIC
  const revenueGrowth = stock.revenueGrowth || 0;
  if (revenueGrowth > 0.2) score += 10; // >20% growth
  else if (revenueGrowth > 0.1) score += 8; // >10% growth
  else if (revenueGrowth > 0.05) score += 5; // >5% growth
  else score += 0;
  
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
 * Prioritize stocks for import
 * @param {Array} stocks - Array of all available stocks
 * @param {Array} existingStocks - Array of stocks already in database
 * @returns {Array} Prioritized array of stocks to import
 */
async function prioritizeStocks(stocks, existingStocks) {
  try {
    console.log('Prioritizing stocks for import...');
    
    // Create a map of existing stocks for quick lookup
    const existingStocksMap = new Map();
    existingStocks.forEach(stock => {
      existingStocksMap.set(stock.symbol, {
        lastUpdated: stock.lastUpdated,
        dataQuality: stock.dataQuality || { completenessScore: 100 }
      });
    });
    
    // Assign priority scores to each stock
    const prioritizedStocks = stocks.map(stock => {
      const existing = existingStocksMap.get(stock.symbol);
      let priorityScore = 0;
      let priorityReason = '';
      
      if (!existing) {
        // New stocks get highest priority
        priorityScore = 100;
        priorityReason = 'new_stock';
      } else {
        // Calculate days since last update
        const daysSinceUpdate = (Date.now() - new Date(existing.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        
        // Older data gets higher priority (max 50 points for 7+ days old)
        const agePriority = Math.min(50, Math.round(daysSinceUpdate * 7));
        
        // Lower quality data gets higher priority (max 50 points for 0% completeness)
        const qualityPriority = Math.min(50, Math.round(50 * (1 - (existing.dataQuality.completenessScore / 100))));
        
        priorityScore = agePriority + qualityPriority;
        priorityReason = `age:${agePriority},quality:${qualityPriority}`;
      }
      
      return {
        ...stock,
        priorityScore,
        priorityReason
      };
    });
    
    // Sort by priority score (highest first)
    prioritizedStocks.sort((a, b) => b.priorityScore - a.priorityScore);
    
    return prioritizedStocks;
  } catch (error) {
    console.error('Error prioritizing stocks:', error);
    // Fall back to original order if prioritization fails
    return stocks;
  }
}

/**
 * Get stocks for current rotation batch
 * @param {Array} prioritizedStocks - Array of prioritized stocks
 * @returns {Array} Batch of stocks for current rotation
 */
function getRotationBatch(prioritizedStocks) {
  const totalStocks = prioritizedStocks.length;
  
  // If we have fewer stocks than batch size, return all
  if (totalStocks <= ROTATION_BATCH_SIZE) {
    return prioritizedStocks;
  }
  
  // Calculate start index for this rotation
  const startIndex = stockRotationIndex % totalStocks;
  
  // Get batch wrapping around the end if necessary
  let batch = [];
  for (let i = 0; i < ROTATION_BATCH_SIZE; i++) {
    const index = (startIndex + i) % totalStocks;
    batch.push(prioritizedStocks[index]);
  }
  
  // Update rotation index for next run
  stockRotationIndex = (startIndex + ROTATION_BATCH_SIZE) % totalStocks;
  
  console.log(`Selected rotation batch ${Math.floor(startIndex / ROTATION_BATCH_SIZE) + 1} of ${Math.ceil(totalStocks / ROTATION_BATCH_SIZE)}`);
  
  return batch;
}

/**
 * Import stock data for a single symbol with enhanced field coverage
 * @param {Object} stockInfo - Basic stock info
 * @returns {Promise<Object>} Promise resolving to imported stock data
 */
async function importStock(stockInfo) {
  try {
    const symbol = stockInfo.symbol;
    console.log(`Importing data for ${symbol}...`);
    
    // Make parallel requests for different data types
    const [profile, quote, ratios, financials, keyMetrics, growth] = await Promise.all([
      makeApiRequest(`/profile/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/quote/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/ratios/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/income-statement/${symbol}?limit=1`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/key-metrics/${symbol}`).then(data => data && data.length > 0 ? data[0] : null),
      makeApiRequest(`/financial-growth/${symbol}`).then(data => data && data.length > 0 ? data[0] : null)
    ]);
    
    // Process and combine data with enhanced field coverage
    const stockData = processStockData(stockInfo, profile, quote, ratios, financials, keyMetrics, growth);
    
    // Return processed data
    return stockData;
  } catch (error) {
    console.error(`Error importing ${stockInfo.symbol}:`, error);
    return null;
  }
}

/**
 * Import stocks with enhanced prioritization and rotation
 * @returns {Promise} Promise resolving when import is complete
 */
async function importStocksEnhanced() {
  try {
    console.log('Starting enhanced stock import process...');
    
    // Update import status
    importStatus = {
      status: 'running',
      startTime: new Date(),
      progress: {
        total: 0,
        completed: 0,
        failed: 0
      },
      dataQuality: {
        missingFields: {},
        validationIssues: {},
        completenessScore: 100
      }
    };
    
    // Get all stock symbols
    console.log('Getting all stock symbols...');
    const allStocks = await getAllStockSymbols();
    
    // Get existing stocks from database
    console.log('Getting existing stocks from database...');
    const Stock = mongoose.model('Stock');
    const existingStocks = await Stock.find({}, { symbol: 1, lastUpdated: 1, dataQuality: 1 }).lean();
    
    console.log(`Found ${existingStocks.length} existing stocks in database`);
    
    // Prioritize stocks based on age, quality, etc.
    const prioritizedStocks = await prioritizeStocks(allStocks, existingStocks);
    
    // Get batch for current rotation
    const batchStocks = getRotationBatch(prioritizedStocks);
    
    console.log(`Selected ${batchStocks.length} stocks for this import run`);
    
    // Update import status
    importStatus.progress.total = batchStocks.length;
    
    // Process stocks in batches with adaptive concurrency
    let completed = 0;
    let failed = 0;
    
    // Process in batches
    for (let i = 0; i < batchStocks.length; i += currentConcurrency) {
      // Check if we're approaching timeout
      if (Date.now() - importStatus.startTime > IMPORT_TIMEOUT) {
        console.log('Import timeout approaching, stopping gracefully');
        break;
      }
      
      const batch = batchStocks.slice(i, i + currentConcurrency);
      
      // Process batch concurrently
      const results = await Promise.allSettled(batch.map(stock => importStock(stock)));
      
      // Process and save results
      const successfulStocks = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          completed++;
          successfulStocks.push(result.value);
          
          // Track data quality issues
          const stock = result.value;
          if (stock.dataQuality && stock.dataQuality.missingFields) {
            stock.dataQuality.missingFields.forEach(field => {
              importStatus.dataQuality.missingFields[field] = (importStatus.dataQuality.missingFields[field] || 0) + 1;
            });
          }
        } else {
          failed++;
        }
      });
      
      // Save successful stocks in bulk
      if (successfulStocks.length > 0) {
        await saveStocksToDB(successfulStocks);
      }
      
      // Update progress
      importStatus.progress = {
        total: batchStocks.length,
        completed,
        failed,
        remaining: batchStocks.length - (completed + failed)
      };
      
      // Log progress
      console.log(`Progress: ${completed + failed}/${batchStocks.length} (${completed} succeeded, ${failed} failed)`);
      
      // No delay between batches to maximize throughput
      // Only add a small delay if we've been rate limited recently
      if (lastRateLimitTime > Date.now() - 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Calculate overall data quality score
    const totalFields = Object.keys(importStatus.dataQuality.missingFields).length;
    const totalMissing = Object.values(importStatus.dataQuality.missingFields).reduce((sum, count) => sum + count, 0);
    const averageMissingPerStock = totalMissing / Math.max(1, completed);
    
    importStatus.dataQuality.completenessScore = Math.max(0, Math.round(100 * (1 - (averageMissingPerStock / totalFields))));
    
    // Update import status
    importStatus = {
      status: 'completed',
      startTime: importStatus.startTime,
      endTime: new Date(),
      progress: {
        total: batchStocks.length,
        completed,
        failed,
        remaining: batchStocks.length - (completed + failed)
      },
      dataQuality: importStatus.dataQuality
    };
    
    console.log('Import completed successfully');
    console.log(`Imported ${completed} stocks, ${failed} failed`);
    console.log(`Data quality score: ${importStatus.dataQuality.completenessScore}%`);
    console.log('Most common missing fields:', importStatus.dataQuality.missingFields);
    
    return {
      total: batchStocks.length,
      completed,
      failed,
      dataQuality: importStatus.dataQuality
    };
  } catch (error) {
    console.error(`[API] importStocksEnhanced: ${error.message}`);
    
    // Update import status
    importStatus = {
      status: 'error',
      startTime: importStatus.startTime,
      endTime: new Date(),
      error: error.message,
      progress: importStatus.progress,
      dataQuality: importStatus.dataQuality
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
    console.log('Starting enhanced FMP import process...');
    
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
        // Added fields
        priceToBook: Number,
        fcfToNetIncome: Number,
        revenueGrowth: Number,
        shareCountGrowth: Number,
        insiderOwnership: Number,
        // Quality tracking
        dataQuality: {
          missingFields: [String],
          validationIssues: mongoose.Schema.Types.Mixed,
          completenessScore: Number
        },
        score: Number,
        lastUpdated: Date
      });
      
      mongoose.model('Stock', stockSchema);
    }
    
    // Run the enhanced import
    const result = await importStocksEnhanced();
    
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
  importStocksEnhanced,
  testApiCallRate,
  runImport,
  processStockData,
  validateNumericField,
  prioritizeStocks,
  getRotationBatch
};
