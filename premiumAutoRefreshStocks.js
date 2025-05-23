/**
 * Premium Automated Stock Data Refresh Script for Heroku
 * 
 * Optimized version for Financial Modeling Prep Premium API users
 * Takes advantage of higher rate limits for faster data processing
 * 
 * Usage:
 * - Manual: node premiumAutoRefreshStocks.js
 * - Heroku: heroku run node premiumAutoRefreshStocks.js --app your-app-name
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, 'premium_refresh_log.txt');

// Log function
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  console.log(message);
};

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB';

// FMP API configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Premium plan optimized settings
const CONCURRENT_REQUESTS = 30; // Higher concurrency for premium plan
const BATCH_SIZE = 50;          // Larger batch size
const REQUEST_DELAY = 50;       // Minimal delay between requests (ms)

// Stock model schema
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
  fcfToNetIncome: Number,
  shareCountGrowth: Number,
  priceToBook: Number,
  insiderOwnership: Number,
  revenueGrowth: Number,
  score: Number,
  lastUpdated: { type: Date, default: Date.now }
});

/**
 * Make API request to Financial Modeling Prep
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  try {
    // Add API key to params
    params.apikey = FMP_API_KEY;
    
    // Build URL
    const url = `${BASE_URL}${endpoint}`;
    
    // Make request with axios
    const response = await axios.get(url, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // Reduced timeout for faster error detection
    });
    
    // Return data
    return response.data;
  } catch (error) {
    console.error('[ERROR] FMP API Request:', error.message);
    throw error;
  }
}

/**
 * Get all stock symbols from FMP
 * @returns {Promise<Array>} - Array of stock objects
 */
async function getAllStocks() {
  try {
    log('Fetching all stock symbols from FMP...');
    
    // Get all stocks from NYSE and NASDAQ
    const stocks = await makeApiRequest('/stock/list', {
      exchange: 'NYSE,NASDAQ'
    });
    
    // Filter out ETFs and preferred stocks
    const filteredStocks = stocks.filter(stock => 
      !stock.name?.includes('ETF') && 
      !stock.name?.includes('ETN') &&
      !stock.symbol?.includes('-') &&
      !stock.symbol?.includes('.') &&
      stock.type === 'stock'
    );
    
    log(`Fetched ${filteredStocks.length} stocks from FMP`);
    
    return filteredStocks;
  } catch (error) {
    log(`Error fetching all stocks: ${error.message}`);
    throw error;
  }
}

/**
 * Get all data for a stock (profile, quote, ratios, metrics)
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Combined stock data
 */
async function getStockData(symbol) {
  try {
    // Get all data in parallel for maximum efficiency
    const [profileResponse, quoteResponse, ratiosResponse, metricsResponse] = await Promise.all([
      makeApiRequest('/profile/' + symbol),
      makeApiRequest('/quote/' + symbol),
      makeApiRequest('/ratios/' + symbol),
      makeApiRequest('/key-metrics/' + symbol)
    ]);
    
    // Extract data from responses
    const profile = profileResponse && profileResponse.length > 0 ? profileResponse[0] : null;
    const quote = quoteResponse && quoteResponse.length > 0 ? quoteResponse[0] : null;
    const ratios = ratiosResponse && ratiosResponse.length > 0 ? ratiosResponse[0] : null;
    const metrics = metricsResponse && metricsResponse.length > 0 ? metricsResponse[0] : null;
    
    if (!profile || !quote) {
      return null; // Skip if essential data is missing
    }
    
    // Calculate score
    const score = calculateScore({
      marketCap: profile?.mktCap || 0,
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      rotce: metrics?.roic || 0
    });
    
    // Return combined data
    return {
      symbol: symbol,
      name: profile?.companyName || '',
      exchange: profile?.exchange || '',
      sector: profile?.sector || '',
      industry: profile?.industry || '',
      price: quote?.price || 0,
      marketCap: profile?.mktCap || 0,
      avgDollarVolume: quote?.avgVolume * quote?.price || 0,
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      rotce: metrics?.roic || 0,
      fcfToNetIncome: metrics?.freeCashFlowToNetIncome || 0,
      shareCountGrowth: metrics?.shareGrowth || 0,
      priceToBook: quote?.priceToBookRatio || 0,
      insiderOwnership: profile?.insiderOwnership || 0,
      revenueGrowth: metrics?.revenueGrowth || 0,
      score: score,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    log(`Error getting data for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Helper function to calculate score
 * @param {Object} details - Stock details
 * @returns {number} - Score
 */
function calculateScore(details) {
  let score = 0;
  
  // Market cap score (0-20)
  if (details.marketCap > 10000000000) score += 20; // $10B+
  else if (details.marketCap > 2000000000) score += 15; // $2B+
  else if (details.marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  if (details.netDebtToEBITDA < 1) score += 20;
  else if (details.netDebtToEBITDA < 2) score += 15;
  else if (details.netDebtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  if (details.evToEBIT > 0 && details.evToEBIT < 10) score += 20;
  else if (details.evToEBIT > 0 && details.evToEBIT < 15) score += 15;
  else if (details.evToEBIT > 0 && details.evToEBIT < 20) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  if (details.rotce > 0.2) score += 20;
  else if (details.rotce > 0.15) score += 15;
  else if (details.rotce > 0.1) score += 10;
  else score += 5;
  
  // Add random factor (0-20) for demonstration
  score += Math.floor(Math.random() * 20);
  
  return score;
}

/**
 * Process a batch of stocks
 * @param {Array} stockBatch - Batch of stocks to process
 * @param {Object} Stock - Mongoose Stock model
 * @returns {Promise<number>} - Number of successfully processed stocks
 */
async function processBatch(stockBatch, Stock) {
  // Create a pool of promises with limited concurrency
  const results = [];
  const activePromises = new Set();
  
  for (const stock of stockBatch) {
    // Wait if we've reached max concurrency
    while (activePromises.size >= CONCURRENT_REQUESTS) {
      await Promise.race(activePromises);
    }
    
    // Process this stock
    const promise = (async () => {
      try {
        // Get stock data
        const stockData = await getStockData(stock.symbol);
        
        if (!stockData) {
          return null;
        }
        
        // Update or insert stock in database
        await Stock.findOneAndUpdate(
          { symbol: stockData.symbol },
          stockData,
          { upsert: true, new: true }
        );
        
        return stockData.symbol;
      } catch (error) {
        log(`Error processing ${stock.symbol}: ${error.message}`);
        return null;
      } finally {
        activePromises.delete(promise);
        
        // Add minimal delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    })();
    
    // Add to active promises
    activePromises.add(promise);
    results.push(promise);
  }
  
  // Wait for all promises to resolve
  const completed = await Promise.all(results);
  
  // Return number of successful operations
  return completed.filter(Boolean).length;
}

/**
 * Import all stocks from FMP
 * @param {Object} Stock - Mongoose Stock model
 * @returns {Promise<void>}
 */
async function importAllStocks(Stock) {
  try {
    log('Starting full stock import from Financial Modeling Prep...');
    
    // Get all stock symbols
    const stocks = await getAllStocks();
    log(`Found ${stocks.length} stocks to import`);
    
    // Process stocks in batches
    const totalBatches = Math.ceil(stocks.length / BATCH_SIZE);
    let totalImported = 0;
    
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)`);
      
      // Process this batch
      const successCount = await processBatch(batch, Stock);
      totalImported += successCount;
      
      log(`Batch ${batchNumber} complete: ${successCount}/${batch.length} stocks imported successfully`);
      log(`Progress: ${totalImported}/${stocks.length} total stocks imported (${Math.round(totalImported/stocks.length*100)}%)`);
    }
    
    log(`Import complete. Total stocks imported: ${totalImported}`);
  } catch (error) {
    log(`Error importing stocks: ${error.message}`);
    throw error;
  }
}

/**
 * Refresh existing stocks in database
 * @param {Object} Stock - Mongoose Stock model
 * @param {number} limit - Maximum number of stocks to refresh
 * @returns {Promise<void>}
 */
async function refreshStocks(Stock, limit = 100) {
  try {
    log(`Starting refresh for up to ${limit} stocks...`);
    
    // Get oldest updated stocks
    const stocks = await Stock.find({})
      .sort({ lastUpdated: 1 })
      .limit(limit);
    
    log(`Found ${stocks.length} stocks to refresh`);
    
    // Convert to format expected by processBatch
    const stocksToProcess = stocks.map(stock => ({ symbol: stock.symbol }));
    
    // Process stocks in batches
    const totalBatches = Math.ceil(stocksToProcess.length / BATCH_SIZE);
    let totalRefreshed = 0;
    
    for (let i = 0; i < stocksToProcess.length; i += BATCH_SIZE) {
      const batch = stocksToProcess.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)`);
      
      // Process this batch
      const successCount = await processBatch(batch, Stock);
      totalRefreshed += successCount;
      
      log(`Batch ${batchNumber} complete: ${successCount}/${batch.length} stocks refreshed successfully`);
    }
    
    log(`Refresh complete. Total stocks refreshed: ${totalRefreshed}`);
  } catch (error) {
    log(`Error refreshing stocks: ${error.message}`);
    throw error;
  }
}

/**
 * Main function to auto-refresh stocks
 * @returns {Promise<boolean>} - Success status
 */
async function autoRefreshStocks() {
  try {
    log('Starting premium automated stock data refresh...');
    
    // Record start time
    const startTime = Date.now();
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('Connected to MongoDB');
    
    // Create or get the Stock model
    let Stock;
    try {
      Stock = mongoose.model('Stock');
    } catch (e) {
      Stock = mongoose.model('Stock', stockSchema);
    }
    
    // Check if database is empty
    const stockCount = await Stock.countDocuments();
    
    if (stockCount === 0) {
      // First run - import all stocks
      log('Database is empty. Running full import...');
      await importAllStocks(Stock);
    } else {
      // Regular refresh - update oldest stocks
      log(`Database has ${stockCount} stocks. Running refresh for oldest 200 stocks...`);
      await refreshStocks(Stock, 200); // Increased from 100 to 200 for premium plan
    }
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    
    log(`Stock data refresh completed successfully in ${duration} minutes`);
    
    // Close MongoDB connection
    await mongoose.connection.close();
    log('MongoDB connection closed');
    
    return true;
  } catch (error) {
    log(`Error during refresh: ${error.message}`);
    
    // Close MongoDB connection if open
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      log('MongoDB connection closed');
    }
    
    return false;
  }
}

// Execute the refresh
autoRefreshStocks().then(success => {
  if (!success) {
    process.exit(1);
  }
});
