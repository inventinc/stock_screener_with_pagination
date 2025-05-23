/**
 * Polygon.io API data refresh service
 * Implements rotating hourly updates during market hours with rate limit protection
 */

const axios = require('axios');
const { connectDB } = require('./db/mongoose');
const stocksDAO = require('./db/stocksDAO');
const { logError } = require('./errorLogger');

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'YOUR_POLYGON_API_KEY';
const BATCH_SIZE = 40; // Number of stocks to update in a single batch
const BATCH_DELAY_MS = 2000; // Delay between batches in milliseconds
const MARKET_HOURS = {
  start: { hour: 9, minute: 30 }, // 9:30 AM ET
  end: { hour: 16, minute: 0 }    // 4:00 PM ET
};
const ROTATION_GROUPS = 6; // Number of groups to divide stocks into for rotation (1 per hour during market hours)

// Track API usage and rate limits
const apiUsageStats = {
  callsMade: 0,
  callsRemaining: 100000, // Default monthly limit for $99 plan
  resetDate: null,
  lastUpdated: null
};

/**
 * Check if current time is during market hours (9:30 AM - 4:00 PM ET, weekdays)
 * @returns {boolean} True if current time is during market hours
 */
function isDuringMarketHours() {
  const now = new Date();
  
  // Check if weekend (0 = Sunday, 6 = Saturday)
  if (now.getDay() === 0 || now.getDay() === 6) {
    return false;
  }
  
  // Convert to ET (UTC-4 during DST, UTC-5 otherwise)
  // This is a simplified approach - production code should use a proper timezone library
  const isDST = false; // Simplified - should be determined based on date
  const etOffset = isDST ? -4 : -5;
  const etHours = (now.getUTCHours() + etOffset + 24) % 24;
  const etMinutes = now.getUTCMinutes();
  
  // Check if within market hours
  const startTotalMinutes = MARKET_HOURS.start.hour * 60 + MARKET_HOURS.start.minute;
  const endTotalMinutes = MARKET_HOURS.end.hour * 60 + MARKET_HOURS.end.minute;
  const currentTotalMinutes = etHours * 60 + etMinutes;
  
  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

/**
 * Update rate limit information based on API response headers
 * @param {Object} headers - Response headers from Polygon.io API
 */
function updateRateLimitInfo(headers) {
  if (headers['x-ratelimit-limit']) {
    apiUsageStats.callsRemaining = parseInt(headers['x-ratelimit-remaining'] || '100000');
    apiUsageStats.resetDate = new Date(parseInt(headers['x-ratelimit-reset'] || Date.now() + 86400000));
    apiUsageStats.lastUpdated = new Date();
  }
}

/**
 * Calculate delay time based on remaining API calls
 * Implements exponential backoff if approaching limits
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay() {
  // If we have plenty of calls remaining, use standard delay
  if (apiUsageStats.callsRemaining > 50000) {
    return BATCH_DELAY_MS;
  }
  
  // If we're below 50% of our limit, start increasing delay
  if (apiUsageStats.callsRemaining > 25000) {
    return BATCH_DELAY_MS * 2;
  }
  
  // If we're below 25% of our limit, increase delay significantly
  if (apiUsageStats.callsRemaining > 10000) {
    return BATCH_DELAY_MS * 5;
  }
  
  // If we're below 10% of our limit, use maximum delay
  return BATCH_DELAY_MS * 10;
}

/**
 * Fetch latest ticker details from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Ticker details
 */
async function fetchTickerDetails(symbol) {
  try {
    const response = await axios.get(`https://api.polygon.io/v3/reference/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    // Update rate limit info
    updateRateLimitInfo(response.headers);
    apiUsageStats.callsMade++;
    
    return response.data.results;
  } catch (error) {
    logError(`Error fetching ticker details for ${symbol}:`, error);
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
    const response = await axios.get(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    // Update rate limit info
    updateRateLimitInfo(response.headers);
    apiUsageStats.callsMade++;
    
    return response.data.ticker;
  } catch (error) {
    logError(`Error fetching latest price for ${symbol}:`, error);
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
    const response = await axios.get(`https://api.polygon.io/v3/reference/financials/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY,
        limit: 1
      }
    });
    
    // Update rate limit info
    updateRateLimitInfo(response.headers);
    apiUsageStats.callsMade++;
    
    return response.data.results[0];
  } catch (error) {
    logError(`Error fetching financial ratios for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Update a single stock with latest data from Polygon.io
 * @param {Object} stock - Stock document from MongoDB
 * @returns {Promise<Object>} Updated stock data
 */
async function updateStockData(stock) {
  try {
    // Fetch ticker details and latest price in parallel
    const [tickerDetails, latestPrice] = await Promise.all([
      fetchTickerDetails(stock.symbol),
      fetchLatestPrice(stock.symbol)
    ]);
    
    // Only fetch financial ratios weekly (to save API calls)
    const dayOfWeek = new Date().getDay();
    let financialRatios = null;
    
    if (dayOfWeek === 1) { // Monday
      financialRatios = await fetchFinancialRatios(stock.symbol);
    }
    
    // Prepare updated stock data
    const updatedStock = {
      ...stock,
      name: tickerDetails.name,
      exchange: tickerDetails.primary_exchange,
      sector: tickerDetails.sic_description,
      industry: tickerDetails.standard_industrial_classification ? 
               tickerDetails.standard_industrial_classification.industry : 'Unknown',
      price: latestPrice?.lastTrade?.p || stock.price,
      marketCap: latestPrice?.day?.v * (latestPrice?.lastTrade?.p || stock.price),
      lastUpdated: new Date()
    };
    
    // Update financial ratios if available
    if (financialRatios) {
      updatedStock.netDebtToEBITDA = financialRatios.ratios?.debtToEbitda || stock.netDebtToEBITDA;
      updatedStock.evToEBIT = financialRatios.ratios?.evToEbit || stock.evToEBIT;
      updatedStock.rotce = financialRatios.ratios?.returnOnTangibleEquity || stock.rotce;
    }
    
    // Save updated stock to database
    await stocksDAO.createOrUpdateStock(updatedStock);
    
    return updatedStock;
  } catch (error) {
    logError(`Error updating stock data for ${stock.symbol}:`, error);
    throw error;
  }
}

/**
 * Update a batch of stocks with latest data from Polygon.io
 * @param {Array<Object>} stocks - Array of stock documents from MongoDB
 * @returns {Promise<Array<Object>>} Updated stocks
 */
async function updateStockBatch(stocks) {
  const updatedStocks = [];
  
  for (const stock of stocks) {
    try {
      // Add delay between individual API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedStock = await updateStockData(stock);
      updatedStocks.push(updatedStock);
      
      console.log(`Updated ${stock.symbol} successfully`);
    } catch (error) {
      console.error(`Failed to update ${stock.symbol}:`, error.message);
    }
  }
  
  return updatedStocks;
}

/**
 * Get the current rotation group based on the hour
 * @returns {number} Current rotation group (0-based)
 */
function getCurrentRotationGroup() {
  const now = new Date();
  const hour = now.getHours();
  
  // Map current hour to rotation group
  // For market hours (9:30 AM - 4:00 PM ET), this will be 0-5
  return hour % ROTATION_GROUPS;
}

/**
 * Run the data refresh process for the current hour
 * @returns {Promise<void>}
 */
async function runHourlyDataRefresh() {
  try {
    // Check if during market hours
    if (!isDuringMarketHours()) {
      console.log('Outside market hours, skipping update');
      return;
    }
    
    // Connect to MongoDB
    await connectDB();
    
    // Get all stocks from database
    const allStocks = await stocksDAO.getStocks();
    console.log(`Found ${allStocks.length} stocks in database`);
    
    // Determine current rotation group
    const currentGroup = getCurrentRotationGroup();
    console.log(`Current rotation group: ${currentGroup + 1}/${ROTATION_GROUPS}`);
    
    // Divide stocks into rotation groups
    const stocksPerGroup = Math.ceil(allStocks.length / ROTATION_GROUPS);
    const startIndex = currentGroup * stocksPerGroup;
    const endIndex = Math.min(startIndex + stocksPerGroup, allStocks.length);
    
    // Get stocks for current rotation group
    const stocksToUpdate = allStocks.slice(startIndex, endIndex);
    console.log(`Updating ${stocksToUpdate.length} stocks in current rotation group`);
    
    // Process stocks in batches
    for (let i = 0; i < stocksToUpdate.length; i += BATCH_SIZE) {
      const batch = stocksToUpdate.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stocksToUpdate.length / BATCH_SIZE)}`);
      
      await updateStockBatch(batch);
      
      // Add delay between batches based on rate limit status
      const delay = calculateBackoffDelay();
      console.log(`Waiting ${delay}ms before next batch (API calls remaining: ${apiUsageStats.callsRemaining})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log('Hourly data refresh completed successfully');
    console.log(`API usage: ${apiUsageStats.callsMade} calls made, ${apiUsageStats.callsRemaining} calls remaining`);
    
  } catch (error) {
    logError('Error during hourly data refresh:', error);
    console.error('Error during hourly data refresh:', error.message);
  }
}

/**
 * Start the data refresh scheduler
 * @returns {Object} Scheduler object with stop method
 */
function startDataRefreshScheduler() {
  console.log('Starting Polygon.io data refresh scheduler');
  
  // Run immediately on startup
  runHourlyDataRefresh();
  
  // Schedule hourly runs
  const intervalId = setInterval(() => {
    runHourlyDataRefresh();
  }, 60 * 60 * 1000); // 1 hour
  
  // Return scheduler object with stop method
  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('Polygon.io data refresh scheduler stopped');
    }
  };
}

module.exports = {
  startDataRefreshScheduler,
  runHourlyDataRefresh,
  isDuringMarketHours,
  apiUsageStats
};
