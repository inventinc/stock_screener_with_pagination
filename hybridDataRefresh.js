/**
 * Updated hybrid data refresh service
 * Combines Polygon.io for ticker details and price data
 * with Yahoo Finance fallback for financial ratios
 */

const axios = require('axios');
const { connectDB } = require('./db/mongoose');
const stocksDAO = require('./db/stocksDAO');
const { calculateScore } = require('./scoreCalculator');
const yahooFinance = require('./yahooFinanceService');

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';
const BATCH_SIZE = 40; // Number of stocks to update in a single batch
const BATCH_DELAY_MS = 2000; // Delay between batches in milliseconds
const MARKET_HOURS = {
  start: { hour: 9, minute: 30 }, // 9:30 AM ET
  end: { hour: 16, minute: 0 }    // 4:00 PM ET
};
const ROTATION_GROUPS = 6; // Number of groups to divide stocks into for rotation (1 per hour during market hours)

// Track API usage and rate limits
const apiUsageStats = {
  polygon: {
    callsMade: 0,
    callsRemaining: 100000, // Default monthly limit
    resetDate: null,
    lastUpdated: null
  },
  yahoo: {
    callsMade: 0,
    lastUpdated: null
  }
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
    apiUsageStats.polygon.callsRemaining = parseInt(headers['x-ratelimit-remaining'] || '100000');
    apiUsageStats.polygon.resetDate = new Date(parseInt(headers['x-ratelimit-reset'] || Date.now() + 86400000));
    apiUsageStats.polygon.lastUpdated = new Date();
  }
}

/**
 * Calculate delay time based on remaining API calls
 * Implements exponential backoff if approaching limits
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay() {
  // If we have plenty of calls remaining, use standard delay
  if (apiUsageStats.polygon.callsRemaining > 50000) {
    return BATCH_DELAY_MS;
  }
  
  // If we're below 50% of our limit, start increasing delay
  if (apiUsageStats.polygon.callsRemaining > 25000) {
    return BATCH_DELAY_MS * 2;
  }
  
  // If we're below 25% of our limit, increase delay significantly
  if (apiUsageStats.polygon.callsRemaining > 10000) {
    return BATCH_DELAY_MS * 5;
  }
  
  // If we're below 10% of our limit, use maximum delay
  return BATCH_DELAY_MS * 10;
}

/**
 * Fetch ticker details from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Ticker details
 */
async function fetchPolygonTickerDetails(symbol) {
  try {
    const response = await axios.get(`https://api.polygon.io/v3/reference/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    // Update rate limit info
    updateRateLimitInfo(response.headers);
    apiUsageStats.polygon.callsMade++;
    
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching Polygon ticker details for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch latest price data from Polygon.io API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Latest price data
 */
async function fetchPolygonLatestPrice(symbol) {
  try {
    const response = await axios.get(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    // Update rate limit info
    updateRateLimitInfo(response.headers);
    apiUsageStats.polygon.callsMade++;
    
    return response.data.ticker;
  } catch (error) {
    console.error(`Error fetching Polygon latest price for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Update a single stock with latest data from both Polygon.io and Yahoo Finance
 * @param {Object} stock - Stock document from MongoDB
 * @returns {Promise<Object>} Updated stock data
 */
async function updateStockData(stock) {
  try {
    // Fetch Polygon.io data
    let tickerDetails, latestPrice;
    try {
      [tickerDetails, latestPrice] = await Promise.all([
        fetchPolygonTickerDetails(stock.symbol),
        fetchPolygonLatestPrice(stock.symbol)
      ]);
    } catch (polygonError) {
      console.error(`Polygon API error for ${stock.symbol}, falling back to Yahoo Finance:`, polygonError.message);
      tickerDetails = null;
      latestPrice = null;
    }
    
    // Fetch Yahoo Finance data for financial ratios (always fetch as fallback)
    let yahooData;
    try {
      yahooData = await yahooFinance.fetchYahooFinanceData(stock.symbol);
    } catch (yahooError) {
      console.error(`Yahoo Finance API error for ${stock.symbol}:`, yahooError.message);
      yahooData = null;
    }
    
    // Extract Yahoo financial ratios if available
    const yahooRatios = yahooData ? yahooFinance.extractYahooFinancialRatios(yahooData) : null;
    
    // Prepare updated stock data, prioritizing Polygon data when available
    const updatedStock = {
      ...stock,
      name: tickerDetails?.name || stock.name,
      exchange: tickerDetails?.primary_exchange || stock.exchange,
      sector: tickerDetails?.sic_description || stock.sector,
      industry: tickerDetails?.standard_industrial_classification?.industry || stock.industry,
      price: latestPrice?.lastTrade?.p || (yahooData?.chartData?.chart?.result?.[0]?.meta?.regularMarketPrice) || stock.price,
      marketCap: latestPrice ? (latestPrice.day?.v * latestPrice.lastTrade?.p) : (yahooRatios?.marketCap || stock.marketCap),
      avgDollarVolume: latestPrice ? (latestPrice.day?.v * latestPrice.lastTrade?.p) : (yahooRatios?.avgDollarVolume || stock.avgDollarVolume),
      lastUpdated: new Date(),
      dataSource: {
        tickerDetails: tickerDetails ? 'polygon' : (yahooData ? 'yahoo' : 'cached'),
        priceData: latestPrice ? 'polygon' : (yahooData ? 'yahoo' : 'cached'),
        financialRatios: yahooData ? 'yahoo' : 'cached'
      }
    };
    
    // Add financial ratios from Yahoo Finance
    if (yahooRatios) {
      updatedStock.netDebtToEBITDA = yahooRatios.netDebtToEBITDA || stock.netDebtToEBITDA;
      updatedStock.evToEBIT = yahooRatios.evToEBIT || stock.evToEBIT;
      updatedStock.rotce = yahooRatios.rotce || stock.rotce;
    }
    
    // Calculate score
    updatedStock.score = calculateScore(updatedStock);
    
    return updatedStock;
  } catch (error) {
    console.error(`Error updating stock data for ${stock.symbol}:`, error.message);
    return {
      ...stock,
      lastUpdated: new Date(),
      dataSource: {
        tickerDetails: 'error',
        priceData: 'error',
        financialRatios: 'error'
      }
    };
  }
}

/**
 * Update a batch of stocks with latest data
 * @param {Array<Object>} stocks - Array of stock documents from MongoDB
 * @returns {Promise<Array<Object>>} Updated stock data
 */
async function updateStockBatch(stocks) {
  const updatedStocks = [];
  
  for (const stock of stocks) {
    try {
      const updatedStock = await updateStockData(stock);
      updatedStocks.push(updatedStock);
      
      // Save to database
      await stocksDAO.updateStock(updatedStock);
      
      // Add small delay between individual stock updates
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error updating stock batch for ${stock.symbol}:`, error.message);
      updatedStocks.push(stock);
    }
  }
  
  return updatedStocks;
}

/**
 * Process all stocks in batches with appropriate delays
 * @param {Array<Object>} allStocks - All stock documents from MongoDB
 * @returns {Promise<void>}
 */
async function processAllStocksInBatches(allStocks) {
  // Determine which rotation group to update based on current hour
  const now = new Date();
  const currentHour = now.getHours();
  const rotationGroup = currentHour % ROTATION_GROUPS;
  
  // Filter stocks for current rotation group
  const stocksToUpdate = allStocks.filter((_, index) => index % ROTATION_GROUPS === rotationGroup);
  
  console.log(`Updating rotation group ${rotationGroup} (${stocksToUpdate.length} stocks)`);
  
  // Process in batches
  for (let i = 0; i < stocksToUpdate.length; i += BATCH_SIZE) {
    const batch = stocksToUpdate.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(stocksToUpdate.length / BATCH_SIZE)}`);
    
    await updateStockBatch(batch);
    
    // Add delay between batches based on rate limit status
    const delay = calculateBackoffDelay();
    console.log(`Waiting ${delay}ms before next batch. API calls made: ${apiUsageStats.polygon.callsMade}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`Completed updating ${stocksToUpdate.length} stocks in rotation group ${rotationGroup}`);
}

/**
 * Main function to refresh stock data
 * @returns {Promise<void>}
 */
async function refreshStockData() {
  try {
    // Only refresh during market hours
    if (!isDuringMarketHours()) {
      console.log('Outside market hours, skipping refresh');
      return;
    }
    
    // Connect to database
    await connectDB();
    
    // Get all stocks
    const allStocks = await stocksDAO.getAllStocks();
    console.log(`Found ${allStocks.length} stocks in database`);
    
    // Process all stocks in batches
    await processAllStocksInBatches(allStocks);
    
    console.log('Stock data refresh completed');
    console.log('API Usage Stats:', apiUsageStats);
  } catch (error) {
    console.error('Error refreshing stock data:', error.message);
  }
}

/**
 * Start the data refresh scheduler
 * @returns {void}
 */
function startDataRefreshScheduler() {
  console.log('Starting data refresh scheduler');
  
  // Perform initial refresh
  refreshStockData();
  
  // Schedule hourly refresh
  setInterval(() => {
    console.log('Running scheduled data refresh');
    refreshStockData();
  }, 60 * 60 * 1000); // Every hour
  
  console.log('Data refresh scheduler started');
}

module.exports = {
  updateStockData,
  refreshStockData,
  startDataRefreshScheduler
};
