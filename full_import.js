/**
 * Full Stock Import Script
 * Imports all stocks from Financial Modeling Prep API in one run
 * Handles batching internally to avoid Heroku timeouts
 */
const mongoose = require('mongoose');
const axios = require('axios');
const Stock = require('./db/models/Stock');

// API configuration
const API_KEY = 'nVR1WhOPm2A0hL8yjk8sVahVjiw9TB5l'; // FMP API key
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Adaptive rate limiting configuration
const RATE_CONFIG = {
  concurrency: 5,           // Number of stocks to process in parallel
  requestSpacing: 200,      // Minimum ms between requests
  batchSize: 100,           // Process stocks in batches of this size
  batchDelay: 5000,         // Delay between batches to avoid timeouts
  retryDelay: 1000,         // Delay before retrying after an error
  maxRetries: 3             // Maximum number of retries per stock
};

// Global counters for monitoring
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;
let lastRequestTime = 0;

/**
 * Make API request with rate limiting
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
  
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`Making API request to: ${url}`);
    const response = await axios.get(url, { params });
    
    // Handle successful request
    successfulRequests++;
    return response.data;
  } catch (error) {
    // Handle rate limiting
    if (error.response && (error.response.status === 429 || error.response.status === 403)) {
      rateLimitedRequests++;
      console.log(`[API] Rate limited. Backing off for ${RATE_CONFIG.retryDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.retryDelay));
      
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
    console.log('Starting getAllStockSymbols function');
    
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
 * Import stock data for a single symbol with retries
 * @param {Object} stockInfo - Basic stock info
 * @param {Number} retryCount - Current retry count
 * @returns {Promise<Object>} Promise resolving to imported stock data
 */
async function importStock(stockInfo, retryCount = 0) {
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
    
    console.log(`Successfully imported ${symbol}`);
    return stockData;
  } catch (error) {
    console.error(`Error importing ${stockInfo.symbol}:`, error);
    
    // Retry if not exceeded max retries
    if (retryCount < RATE_CONFIG.maxRetries) {
      console.log(`Retrying ${stockInfo.symbol} (attempt ${retryCount + 1}/${RATE_CONFIG.maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.retryDelay));
      return importStock(stockInfo, retryCount + 1);
    }
    
    return null;
  }
}

/**
 * Process a batch of stocks
 * @param {Array} stocks - Array of stock info objects
 * @param {Number} batchIndex - Current batch index
 * @param {Number} totalBatches - Total number of batches
 * @returns {Promise<Object>} Promise resolving to batch results
 */
async function processBatch(stocks, batchIndex, totalBatches) {
  console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${stocks.length} stocks)`);
  
  let completed = 0;
  let failed = 0;
  
  // Process stocks in parallel with limited concurrency
  for (let i = 0; i < stocks.length; i += RATE_CONFIG.concurrency) {
    const chunk = stocks.slice(i, i + RATE_CONFIG.concurrency);
    
    // Process chunk concurrently
    const results = await Promise.allSettled(chunk.map(stock => importStock(stock)));
    
    // Count successes and failures
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        completed++;
      } else {
        failed++;
      }
    });
    
    // Log progress
    const totalProcessed = completed + failed;
    const batchProgress = Math.round((totalProcessed / stocks.length) * 100);
    console.log(`Batch ${batchIndex + 1} progress: ${totalProcessed}/${stocks.length} (${batchProgress}%) - ${completed} succeeded, ${failed} failed`);
  }
  
  return { completed, failed };
}

/**
 * Import all stocks with batching to avoid timeouts
 * @returns {Promise} Promise resolving when import is complete
 */
async function importAllStocks() {
  try {
    console.log('Starting full import of all stocks');
    
    // Get all stock symbols
    console.log('Getting all tickers...');
    const allStocks = await getAllStockSymbols();
    console.log(`Retrieved ${allStocks.length} stocks to import`);
    
    // Calculate batches
    const totalBatches = Math.ceil(allStocks.length / RATE_CONFIG.batchSize);
    console.log(`Will process in ${totalBatches} batches of ${RATE_CONFIG.batchSize} stocks each`);
    
    // Process all batches
    let totalCompleted = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      // Get current batch
      const startIdx = i * RATE_CONFIG.batchSize;
      const endIdx = Math.min(startIdx + RATE_CONFIG.batchSize, allStocks.length);
      const batchStocks = allStocks.slice(startIdx, endIdx);
      
      // Process batch
      const { completed, failed } = await processBatch(batchStocks, i, totalBatches);
      
      // Update totals
      totalCompleted += completed;
      totalFailed += failed;
      
      // Log overall progress
      const overallProgress = Math.round(((i + 1) / totalBatches) * 100);
      console.log(`Overall progress: ${overallProgress}% - Batch ${i + 1}/${totalBatches} completed`);
      console.log(`Total stats: ${totalCompleted} succeeded, ${totalFailed} failed, ${totalCompleted + totalFailed}/${allStocks.length} processed`);
      
      // Delay between batches to avoid timeouts (except for last batch)
      if (i < totalBatches - 1) {
        console.log(`Waiting ${RATE_CONFIG.batchDelay / 1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, RATE_CONFIG.batchDelay));
      }
    }
    
    console.log('Full import completed successfully');
    console.log(`Final results: ${totalCompleted} stocks imported, ${totalFailed} failed`);
    
    return {
      total: allStocks.length,
      completed: totalCompleted,
      failed: totalFailed
    };
  } catch (error) {
    console.error(`[ERROR] importAllStocks: ${error.message}`);
    throw error;
  }
}

// Connect to MongoDB and run import
console.log('Starting full stock import process...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB')
  .then(() => {
    console.log('Connected to MongoDB');
    return importAllStocks();
  })
  .then((result) => {
    console.log('Import completed with results:', result);
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('Error:', error);
    mongoose.disconnect();
  });
