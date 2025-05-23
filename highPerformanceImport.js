/**
 * High Performance Comprehensive Stock Import Script
 * 
 * This script performs an optimized import of all stocks from Financial Modeling Prep API
 * while still collecting all 30+ data points. Designed for maximum efficiency without
 * sacrificing data completeness.
 * 
 * Usage:
 * - Manual: node highPerformanceImport.js
 * - Heroku: heroku run node highPerformanceImport.js --app your-app-name
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, 'high_performance_import_log.txt');

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

// Performance optimization settings
const CPU_COUNT = os.cpus().length;
const CONCURRENT_REQUESTS = Math.min(20, CPU_COUNT * 2); // Scale with available CPUs, max 20
const BATCH_SIZE = 50;
const REQUEST_DELAY = 100; // ms
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // ms
const MAX_RETRY_DELAY = 10000; // ms
const BULK_WRITE_SIZE = 100; // Number of operations to bulk write

// Stock model schema with comprehensive fields
const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: String,
  exchange: String,
  sector: String,
  industry: String,
  price: Number,
  marketCap: Number,
  avgDollarVolume: Number,
  volume: Number,
  beta: Number,
  lastDividend: Number,
  dividendYield: Number,
  
  // Valuation metrics
  peRatio: Number,
  forwardPE: Number,
  pegRatio: Number,
  priceToBook: Number,
  priceToSales: Number,
  evToEBITDA: Number,
  evToEBIT: Number,
  evToRevenue: Number,
  
  // Debt and liquidity metrics
  netDebtToEBITDA: Number,
  debtToEquity: Number,
  currentRatio: Number,
  quickRatio: Number,
  
  // Profitability metrics
  grossMargin: Number,
  operatingMargin: Number,
  netMargin: Number,
  rotce: Number,
  returnOnEquity: Number,
  returnOnAssets: Number,
  
  // Growth metrics
  revenueGrowth: Number,
  earningsGrowth: Number,
  dividendGrowth: Number,
  fcfGrowth: Number,
  shareCountGrowth: Number,
  
  // Cash flow metrics
  fcfToNetIncome: Number,
  fcfYield: Number,
  capexToRevenue: Number,
  
  // Ownership metrics
  insiderOwnership: Number,
  institutionalOwnership: Number,
  
  // Additional metrics
  eps: Number,
  sharesOutstanding: Number,
  
  // Calculated score and metadata
  score: Number,
  lastUpdated: { type: Date, default: Date.now }
});

// Create an axios instance with default settings
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request queue to manage API call rate
class RequestQueue {
  constructor(concurrency = 10, delay = 100) {
    this.concurrency = concurrency;
    this.delay = delay;
    this.running = 0;
    this.queue = [];
    this.lastRequestTime = 0;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.delay) {
      await new Promise(resolve => setTimeout(resolve, this.delay - timeSinceLastRequest));
    }

    const item = this.queue.shift();
    this.running++;
    this.lastRequestTime = Date.now();

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Create request queue
const requestQueue = new RequestQueue(CONCURRENT_REQUESTS, REQUEST_DELAY);

/**
 * Make API request to Financial Modeling Prep with smart retry logic
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  // Add API key to params
  params.apikey = FMP_API_KEY;
  
  let retries = 0;
  let lastError = null;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Queue the request
      const response = await requestQueue.add(() => 
        api.get(endpoint, { params })
      );
      
      // Return data on success
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Handle rate limiting with exponential backoff
      if (error.response && error.response.status === 429) {
        retries++;
        
        if (retries > MAX_RETRIES) {
          break;
        }
        
        // Calculate exponential backoff with jitter
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retries - 1) + Math.random() * 1000,
          MAX_RETRY_DELAY
        );
        
        log(`Rate limited, retrying after ${Math.round(delay)}ms (${MAX_RETRIES - retries + 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For non-rate-limit errors, retry once with a short delay
        if (retries === 0) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          break;
        }
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

/**
 * Get all stock symbols from FMP with caching
 * @returns {Promise<Array>} - Array of stock objects
 */
async function getAllStocks() {
  try {
    const cacheFile = path.join(logsDir, 'stock_list_cache.json');
    
    // Try to use cached stock list if available and recent (less than 24 hours old)
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const cacheAge = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60); // hours
      
      if (cacheAge < 24) {
        log(`Using cached stock list (${cacheAge.toFixed(2)} hours old)`);
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        return cachedData;
      }
    }
    
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
    
    // Cache the results
    fs.writeFileSync(cacheFile, JSON.stringify(filteredStocks));
    
    return filteredStocks;
  } catch (error) {
    log(`Error fetching all stocks: ${error.message}`);
    throw error;
  }
}

/**
 * Get comprehensive stock data from multiple FMP endpoints with optimized fetching
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Combined stock data
 */
async function getComprehensiveStockData(symbol) {
  try {
    // Get data from multiple endpoints in parallel
    const [
      profileResponse, 
      quoteResponse, 
      ratiosResponse, 
      metricsResponse,
      growthResponse,
      cashFlowResponse,
      incomeResponse
    ] = await Promise.all([
      makeApiRequest('/profile/' + symbol),
      makeApiRequest('/quote/' + symbol),
      makeApiRequest('/ratios/' + symbol),
      makeApiRequest('/key-metrics/' + symbol),
      makeApiRequest('/financial-growth/' + symbol),
      makeApiRequest('/cash-flow-statement/' + symbol, { limit: 1, period: 'annual' }),
      makeApiRequest('/income-statement/' + symbol, { limit: 1, period: 'annual' })
    ]);
    
    // Extract data from responses
    const profile = profileResponse && profileResponse.length > 0 ? profileResponse[0] : null;
    const quote = quoteResponse && quoteResponse.length > 0 ? quoteResponse[0] : null;
    const ratios = ratiosResponse && ratiosResponse.length > 0 ? ratiosResponse[0] : null;
    const metrics = metricsResponse && metricsResponse.length > 0 ? metricsResponse[0] : null;
    const growth = growthResponse && growthResponse.length > 0 ? growthResponse[0] : null;
    const cashFlow = cashFlowResponse && cashFlowResponse.length > 0 ? cashFlowResponse[0] : null;
    const income = incomeResponse && incomeResponse.length > 0 ? incomeResponse[0] : null;
    
    if (!profile || !quote) {
      return null; // Skip if essential data is missing
    }
    
    // Calculate score
    const score = calculateScore({
      marketCap: profile?.mktCap || 0,
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      rotce: metrics?.roic || 0,
      grossMargin: ratios?.grossProfitMargin || 0,
      fcfYield: metrics?.freeCashFlowYield || 0
    });
    
    // Return comprehensive data object with all fields
    return {
      symbol: symbol,
      name: profile?.companyName || '',
      exchange: profile?.exchange || '',
      sector: profile?.sector || '',
      industry: profile?.industry || '',
      
      // Price and market data
      price: quote?.price || 0,
      marketCap: profile?.mktCap || 0,
      avgDollarVolume: quote?.avgVolume * quote?.price || 0,
      volume: quote?.volume || 0,
      beta: quote?.beta || 0,
      lastDividend: quote?.lastDiv || 0,
      dividendYield: quote?.lastDiv / quote?.price || 0,
      
      // Valuation metrics
      peRatio: quote?.pe || 0,
      forwardPE: quote?.forwardPE || 0,
      pegRatio: ratios?.pegRatio || 0,
      priceToBook: quote?.priceToBookRatio || 0,
      priceToSales: ratios?.priceToSalesRatio || 0,
      evToEBITDA: ratios?.enterpriseValueOverEBITDA || 0,
      evToEBIT: ratios?.enterpriseValueOverEBIT || 0,
      evToRevenue: ratios?.evToSales || 0,
      
      // Debt and liquidity metrics
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      debtToEquity: ratios?.debtToEquity || 0,
      currentRatio: ratios?.currentRatio || 0,
      quickRatio: ratios?.quickRatio || 0,
      
      // Profitability metrics
      grossMargin: ratios?.grossProfitMargin || 0,
      operatingMargin: ratios?.operatingProfitMargin || 0,
      netMargin: ratios?.netProfitMargin || 0,
      rotce: metrics?.roic || 0,
      returnOnEquity: ratios?.returnOnEquity || 0,
      returnOnAssets: ratios?.returnOnAssets || 0,
      
      // Growth metrics
      revenueGrowth: growth?.revenueGrowth || 0,
      earningsGrowth: growth?.netIncomeGrowth || 0,
      dividendGrowth: growth?.dividendPerShareGrowth || 0,
      fcfGrowth: growth?.freeCashFlowGrowth || 0,
      shareCountGrowth: metrics?.shareGrowth || 0,
      
      // Cash flow metrics
      fcfToNetIncome: metrics?.freeCashFlowToNetIncome || 0,
      fcfYield: metrics?.freeCashFlowYield || 0,
      capexToRevenue: cashFlow?.capitalExpenditure / income?.revenue || 0,
      
      // Ownership metrics
      insiderOwnership: profile?.insiderOwnership || 0,
      institutionalOwnership: profile?.institutionalOwnership || 0,
      
      // Additional metrics
      eps: quote?.eps || 0,
      sharesOutstanding: profile?.mktCap / quote?.price || 0,
      
      // Score and metadata
      score: score,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    log(`Error getting comprehensive data for ${symbol}: ${error.message}`);
    return null;
  }
}

/**
 * Helper function to calculate score based on multiple factors
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
  
  // Gross margin score (0-10)
  if (details.grossMargin > 0.5) score += 10;
  else if (details.grossMargin > 0.3) score += 7;
  else if (details.grossMargin > 0.2) score += 5;
  else score += 2;
  
  // FCF yield score (0-10)
  if (details.fcfYield > 0.1) score += 10;
  else if (details.fcfYield > 0.05) score += 7;
  else if (details.fcfYield > 0.02) score += 5;
  else score += 2;
  
  return score;
}

/**
 * Process a batch of stocks with optimized concurrency and bulk writes
 * @param {Array} stockBatch - Batch of stocks to process
 * @param {Object} Stock - Mongoose Stock model
 * @returns {Promise<number>} - Number of successfully processed stocks
 */
async function processBatch(stockBatch, Stock) {
  // Process all stocks in the batch concurrently
  const stockDataPromises = stockBatch.map(stock => getComprehensiveStockData(stock.symbol));
  
  // Wait for all stock data to be fetched
  const stockDataResults = await Promise.all(stockDataPromises);
  
  // Filter out null results
  const validStockData = stockDataResults.filter(Boolean);
  
  if (validStockData.length === 0) {
    return 0;
  }
  
  // Use bulk operations for better performance
  const bulkOps = validStockData.map(stockData => ({
    updateOne: {
      filter: { symbol: stockData.symbol },
      update: stockData,
      upsert: true
    }
  }));
  
  // Split bulk operations into chunks to avoid MongoDB document size limits
  const bulkOpsChunks = [];
  for (let i = 0; i < bulkOps.length; i += BULK_WRITE_SIZE) {
    bulkOpsChunks.push(bulkOps.slice(i, i + BULK_WRITE_SIZE));
  }
  
  // Execute all bulk write operations
  for (const chunk of bulkOpsChunks) {
    await Stock.bulkWrite(chunk);
  }
  
  return validStockData.length;
}

/**
 * High performance import of all stocks from FMP
 * @param {Object} Stock - Mongoose Stock model
 * @returns {Promise<void>}
 */
async function highPerformanceImport(Stock) {
  try {
    log('Starting HIGH PERFORMANCE IMPORT of all stocks with comprehensive data...');
    
    // Get all stock symbols
    const stocks = await getAllStocks();
    log(`Found ${stocks.length} stocks to import`);
    
    // Process stocks in batches
    const totalBatches = Math.ceil(stocks.length / BATCH_SIZE);
    let totalImported = 0;
    
    // Track performance metrics
    const batchTimes = [];
    const startTime = Date.now();
    
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batchStartTime = Date.now();
      const batch = stocks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)`);
      
      // Process this batch
      const successCount = await processBatch(batch, Stock);
      totalImported += successCount;
      
      // Calculate batch processing time
      const batchTime = (Date.now() - batchStartTime) / 1000;
      batchTimes.push(batchTime);
      
      // Calculate average time per stock and estimated time remaining
      const avgTimePerStock = batchTimes.reduce((sum, time) => sum + time, 0) / 
                             (batchTimes.length * BATCH_SIZE);
      const stocksRemaining = stocks.length - (i + BATCH_SIZE);
      const estimatedTimeRemaining = stocksRemaining * avgTimePerStock;
      
      log(`Batch ${batchNumber} complete: ${successCount}/${batch.length} stocks imported successfully in ${batchTime.toFixed(2)}s`);
      log(`Progress: ${totalImported}/${stocks.length} total stocks imported (${Math.round(totalImported/stocks.length*100)}%)`);
      
      if (stocksRemaining > 0) {
        const remainingMins = Math.floor(estimatedTimeRemaining / 60);
        const remainingSecs = Math.floor(estimatedTimeRemaining % 60);
        log(`Estimated time remaining: ${remainingMins}m ${remainingSecs}s`);
      }
    }
    
    // Calculate total duration
    const totalDuration = (Date.now() - startTime) / 1000;
    const durationMins = Math.floor(totalDuration / 60);
    const durationSecs = Math.floor(totalDuration % 60);
    
    log(`High performance import complete. Total stocks imported: ${totalImported}`);
    log(`Total import time: ${durationMins}m ${durationSecs}s (${(totalDuration / 60).toFixed(2)} minutes)`);
  } catch (error) {
    log(`Error importing stocks: ${error.message}`);
    throw error;
  }
}

/**
 * Main function to run high performance import
 * @returns {Promise<boolean>} - Success status
 */
async function main() {
  try {
    log('Starting high performance import of all stocks with comprehensive data...');
    
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
    
    // Get current stock count
    const initialCount = await Stock.countDocuments();
    log(`Current database has ${initialCount} stocks before import`);
    
    // Run high performance import
    await highPerformanceImport(Stock);
    
    // Get new stock count
    const finalCount = await Stock.countDocuments();
    log(`Database now has ${finalCount} stocks after import`);
    log(`Added ${finalCount - initialCount} new stocks to the database`);
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    
    log(`High performance import completed successfully in ${duration} minutes`);
    
    // Close MongoDB connection
    await mongoose.connection.close();
    log('MongoDB connection closed');
    
    return true;
  } catch (error) {
    log(`Error during import: ${error.message}`);
    
    // Close MongoDB connection if open
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      log('MongoDB connection closed');
    }
    
    return false;
  }
}

// Execute the high performance import
main().then(success => {
  if (!success) {
    process.exit(1);
  }
});
