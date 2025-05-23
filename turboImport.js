/**
 * Turbo Import Module for Polygon.io stock data
 * Optimized for maximum throughput with aggressive concurrency and minimal backoff
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const errorLogger = require('./errorLogger');

// API configuration
const API_KEY = 'gBEpwqDpCcL1SLHyjVdi3HZ_8YXccEHO';
const BASE_URL = 'https://api.polygon.io';

// Import status constants
const IMPORT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited'
};

// Global counters for monitoring
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let rateLimitedRequests = 0;

/**
 * Make API request to Polygon.io with minimal delay and aggressive retry
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  totalRequests++;
  
  try {
    // Add API key to params
    params.apiKey = API_KEY;
    
    // Build URL
    const url = `${BASE_URL}${endpoint}`;
    
    // Make request with axios
    const response = await axios.get(url, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout (reduced from 30s)
    });
    
    successfulRequests++;
    
    // Return data immediately
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      rateLimitedRequests++;
      console.log(`[RATE_LIMIT] makeApiRequest: Rate limit exceeded (total: ${rateLimitedRequests})`);
      
      // Minimal backoff for rate limits - just 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Retry request immediately
      return makeApiRequest(endpoint, params);
    } else {
      failedRequests++;
      console.error('[ERROR] makeApiRequest:', error.message);
      errorLogger.logError(error, 'makeApiRequest', { endpoint, params });
      
      // For other errors, retry after a brief pause (only for GET requests which are idempotent)
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        console.log('[RETRY] Connection issue, retrying after brief pause...');
        await new Promise(resolve => setTimeout(resolve, 200));
        return makeApiRequest(endpoint, params);
      }
      
      throw error;
    }
  }
}

/**
 * Update import status
 * @param {string} status - Import status
 * @param {string} message - Status message
 * @param {Error} error - Error object (optional)
 */
function updateImportStatus(status, message, error = null) {
  try {
    const statusFile = path.join(__dirname, 'data', 'import_status.json');
    
    // Create status object
    const statusData = {
      status,
      lastRun: new Date().toISOString(),
      lastError: error ? error.message : null,
      rateLimitReset: error && error.rateLimitReset ? error.rateLimitReset.toISOString() : null,
      message,
      stats: {
        totalRequests,
        successfulRequests,
        failedRequests,
        rateLimitedRequests
      }
    };
    
    // Write to file
    fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Error updating import status:', error);
  }
}

/**
 * Get all tickers from Polygon.io at maximum speed
 * @returns {Promise<Array>} - Array of ticker objects
 */
async function getAllTickers() {
  try {
    console.log('Starting getAllTickers function at maximum speed');
    
    // Make API request
    const tickers = [];
    let nextUrl = `/v3/reference/tickers`;
    let params = {
      market: 'stocks',
      active: true,
      limit: 1000, // Maximum batch size for faster import
      type: 'CS' // Common Stock only, excludes ETFs
    };
    
    console.log(`Making initial API request to: ${nextUrl} with params:`, params);
    
    // Only fetch NYSE and NASDAQ stocks
    const allowedExchanges = ['XNYS', 'XNAS'];
    
    // First API call
    try {
      const response = await makeApiRequest(nextUrl, params);
      console.log(`Initial API response received with ${response.results ? response.results.length : 0} tickers`);
      
      if (response.results) {
        // Filter for NYSE and NASDAQ only and exclude ETFs
        const filteredResults = response.results.filter(ticker => 
          (allowedExchanges.includes(ticker.market) || 
           allowedExchanges.includes(ticker.primary_exchange)) &&
          ticker.type !== 'ETF' && 
          !ticker.name?.includes('ETF') &&
          !ticker.ticker?.includes('-')  // Exclude preferred stocks
        );
        
        console.log(`Filtered to ${filteredResults.length} NYSE/NASDAQ equities (excluding ETFs)`);
        tickers.push(...filteredResults);
        
        // Check if we have a next_url for pagination
        nextUrl = response.next_url;
      } else {
        console.error('No results found in API response:', JSON.stringify(response));
        return [];
      }
    } catch (error) {
      console.error('Error in initial ticker fetch:', error.message);
      errorLogger.logError(error, 'getAllTickers.initialFetch');
      throw error;
    }
    
    // Process pagination to get all tickers at maximum speed
    console.log('Processing pagination for all tickers at maximum speed');
    let pageCount = 1;
    
    // Create an array to hold all pagination promises
    const paginationPromises = [];
    const maxConcurrentRequests = 30; // Very high concurrency for maximum throughput
    let activePromises = 0;
    
    while (nextUrl && pageCount < 50) { // Limit to 50 pages to ensure we get some data quickly
      try {
        console.log(`Queueing page ${pageCount} with URL: ${nextUrl}`);
        
        // For next_url, we need to make a direct axios request since it's a full URL
        const currentUrl = nextUrl;
        
        // Create a function to process this page
        const processPage = async () => {
          try {
            console.log(`Fetching page ${pageCount} with URL: ${currentUrl}`);
            let response;
            
            if (currentUrl.startsWith('http')) {
              console.log('Making direct axios request to full URL');
              const axiosResponse = await axios.get(currentUrl, {
                params: { apiKey: API_KEY },
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 second timeout
              });
              response = axiosResponse.data;
            } else {
              console.log('Making API request with relative URL');
              response = await makeApiRequest(currentUrl);
            }
            
            console.log(`Page ${pageCount} response received with ${response.results ? response.results.length : 0} tickers`);
            
            if (response.results) {
              // Filter for NYSE and NASDAQ only and exclude ETFs
              const filteredResults = response.results.filter(ticker => 
                (allowedExchanges.includes(ticker.market) || 
                 allowedExchanges.includes(ticker.primary_exchange)) &&
                ticker.type !== 'ETF' && 
                !ticker.name?.includes('ETF') &&
                !ticker.ticker?.includes('-')  // Exclude preferred stocks
              );
              
              console.log(`Filtered to ${filteredResults.length} NYSE/NASDAQ equities (excluding ETFs) on page ${pageCount}`);
              return filteredResults;
            }
            return [];
          } catch (error) {
            console.error(`Error fetching page ${pageCount}:`, error.message);
            errorLogger.logError(error, 'getAllTickers.pagination', { page: pageCount });
            return []; // Return empty array on error to continue processing
          }
        };
        
        // Wait if we've reached the maximum concurrent requests
        while (activePromises >= maxConcurrentRequests) {
          await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause to check again
          
          // Count active promises
          activePromises = paginationPromises.filter(p => p.status === 'pending').length;
        }
        
        // Add this page to the queue
        activePromises++;
        const promise = processPage().then(results => {
          activePromises--;
          return results;
        });
        paginationPromises.push(promise);
        
        // Get next URL for pagination
        nextUrl = null; // Will be updated if we have more pages
        
        // Move to next page
        pageCount++;
      } catch (error) {
        console.error(`Error processing pagination for page ${pageCount}:`, error.message);
        errorLogger.logError(error, 'getAllTickers.paginationLoop', { page: pageCount });
        break; // Exit loop on error
      }
    }
    
    console.log(`Waiting for ${paginationPromises.length} pagination promises to resolve...`);
    
    // Wait for all pagination promises to resolve
    const results = await Promise.all(paginationPromises);
    
    // Flatten results and add to tickers array
    results.forEach(pageResults => {
      tickers.push(...pageResults);
    });
    
    console.log(`Total tickers after pagination: ${tickers.length}`);
    
    // Save tickers to file for debugging
    const tickersFile = path.join(__dirname, 'data', 'all_tickers.json');
    fs.writeFileSync(tickersFile, JSON.stringify(tickers, null, 2));
    
    return tickers;
  } catch (error) {
    console.error('Error in getAllTickers:', error.message);
    errorLogger.logError(error, 'getAllTickers');
    throw error;
  }
}

/**
 * Get ticker details from Polygon.io
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<Object>} - Ticker details
 */
async function getTickerDetails(symbol) {
  try {
    const endpoint = `/v3/reference/tickers/${symbol}`;
    const response = await makeApiRequest(endpoint);
    return response.results;
  } catch (error) {
    console.error(`Error getting details for ${symbol}:`, error.message);
    errorLogger.logError(error, 'getTickerDetails', { symbol });
    return null;
  }
}

/**
 * Get ticker price from Polygon.io
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<Object>} - Ticker price
 */
async function getTickerPrice(symbol) {
  try {
    const endpoint = `/v2/aggs/ticker/${symbol}/prev`;
    const response = await makeApiRequest(endpoint);
    
    if (response.results && response.results.length > 0) {
      return response.results[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting price for ${symbol}:`, error.message);
    errorLogger.logError(error, 'getTickerPrice', { symbol });
    return null;
  }
}

/**
 * Get financial ratios from Polygon.io
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<Object>} - Financial ratios
 */
async function getFinancialRatios(symbol) {
  try {
    const endpoint = `/v3/reference/financials/${symbol}`;
    const params = {
      limit: 5,
      type: 'Q'
    };
    
    const response = await makeApiRequest(endpoint, params);
    
    if (response.results && response.results.length > 0) {
      return response.results[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting financial ratios for ${symbol}:`, error.message);
    errorLogger.logError(error, 'getFinancialRatios', { symbol });
    return null;
  }
}

/**
 * Process ticker data and save to file
 * @param {Array} tickers - Array of ticker objects
 * @returns {Promise<void>}
 */
async function processTickerData(tickers) {
  try {
    console.log(`Processing ${tickers.length} tickers...`);
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Read existing stocks data if available
    const stocksFile = path.join(dataDir, 'all_stocks.json');
    let existingStocks = [];
    
    if (fs.existsSync(stocksFile)) {
      try {
        const stocksData = fs.readFileSync(stocksFile, 'utf8');
        existingStocks = JSON.parse(stocksData);
        console.log(`Loaded ${existingStocks.length} existing stocks from file`);
      } catch (error) {
        console.error('Error reading existing stocks file:', error.message);
        errorLogger.logError(error, 'processTickerData.readExistingStocks');
      }
    }
    
    // Create a map of existing stocks for quick lookup
    const existingStocksMap = new Map();
    existingStocks.forEach(stock => {
      existingStocksMap.set(stock.symbol, stock);
    });
    
    // Process all tickers in parallel with high concurrency
    console.log('Processing all tickers in parallel with high concurrency');
    
    // Maximum concurrency for details, prices, and ratios
    const maxConcurrency = 30; // Very high concurrency for maximum throughput
    
    // Create a queue for processing
    const queue = [...tickers];
    const processingPromises = [];
    
    // Process queue with high concurrency
    let activePromises = 0;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Save progress periodically
    let lastSaveTime = Date.now();
    const saveInterval = 60000; // Save every minute
    
    // Process queue until empty
    while (queue.length > 0 || activePromises > 0) {
      // Process more items if below max concurrency and queue not empty
      while (activePromises < maxConcurrency && queue.length > 0) {
        const ticker = queue.shift();
        
        // Skip if already exists in our database
        if (existingStocksMap.has(ticker.ticker)) {
          skippedCount++;
          continue;
        }
        
        activePromises++;
        
        // Process this ticker
        const promise = (async () => {
          try {
            processedCount++;
            
            // Get ticker details, price, and financial ratios
            const [details, price, financials] = await Promise.all([
              getTickerDetails(ticker.ticker),
              getTickerPrice(ticker.ticker),
              getFinancialRatios(ticker.ticker)
            ]);
            
            // Create stock object
            const stock = {
              symbol: ticker.ticker,
              name: ticker.name,
              exchange: ticker.primary_exchange || ticker.market,
              sector: details?.sic_description?.split(' - ')[0] || null,
              industry: details?.sic_description?.split(' - ')[1] || null,
              price: price?.c || null,
              marketCap: details?.market_cap || null,
              avgDollarVolume: price?.v * price?.c || null,
              netDebtToEBITDA: financials?.ratios?.net_debt_to_ebitda || null,
              evToEBIT: financials?.ratios?.ev_to_ebit || null,
              rotce: financials?.ratios?.return_on_tangible_capital_employed || null,
              fcfToNetIncome: financials?.ratios?.fcf_to_net_income || null,
              shareCountGrowth: financials?.ratios?.share_count_growth || null,
              priceToBook: financials?.ratios?.price_to_book || null,
              insiderOwnership: details?.insider_ownership || null,
              revenueGrowth: financials?.ratios?.revenue_growth || null,
              lastUpdated: new Date().toISOString()
            };
            
            // Add to existing stocks
            existingStocks.push(stock);
            existingStocksMap.set(stock.symbol, stock);
            
            successCount++;
            
            // Log progress
            if (processedCount % 10 === 0) {
              console.log(`Processed ${processedCount}/${tickers.length} tickers (${successCount} success, ${errorCount} errors, ${skippedCount} skipped)`);
              
              // Update batch progress
              updateBatchProgress(processedCount, tickers.length, successCount, errorCount);
            }
            
            // Save periodically
            const now = Date.now();
            if (now - lastSaveTime > saveInterval) {
              console.log('Saving progress...');
              fs.writeFileSync(stocksFile, JSON.stringify(existingStocks, null, 2));
              lastSaveTime = now;
              console.log('Progress saved');
            }
          } catch (error) {
            console.error(`Error processing ticker ${ticker.ticker}:`, error.message);
            errorLogger.logError(error, 'processTickerData.processTicker', { symbol: ticker.ticker });
            errorCount++;
          } finally {
            activePromises--;
          }
        })();
        
        processingPromises.push(promise);
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for all processing to complete
    await Promise.all(processingPromises);
    
    // Save final results
    console.log('Saving final results...');
    fs.writeFileSync(stocksFile, JSON.stringify(existingStocks, null, 2));
    
    // Update final batch progress
    updateBatchProgress(processedCount, tickers.length, successCount, errorCount, true);
    
    console.log(`Processed ${processedCount}/${tickers.length} tickers (${successCount} success, ${errorCount} errors, ${skippedCount} skipped)`);
    console.log(`Total stocks in database: ${existingStocks.length}`);
  } catch (error) {
    console.error('Error in processTickerData:', error.message);
    errorLogger.logError(error, 'processTickerData');
    throw error;
  }
}

/**
 * Update batch progress
 * @param {number} processed - Number of processed tickers
 * @param {number} total - Total number of tickers
 * @param {number} success - Number of successful tickers
 * @param {number} failed - Number of failed tickers
 * @param {boolean} completed - Whether the batch is completed
 */
function updateBatchProgress(processed, total, success, failed, completed = false) {
  try {
    const batchProgressFile = path.join(__dirname, 'data', 'batch_progress.json');
    
    // Create batch progress object
    const batchProgress = {
      lastUpdated: new Date().toISOString(),
      currentBatch: 1,
      totalBatches: 1,
      totalSymbols: total,
      processedSymbols: processed,
      successfulSymbols: success,
      failedSymbols: failed,
      completed: completed,
      errors: []
    };
    
    // Write to file
    fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
  } catch (error) {
    console.error('Error updating batch progress:', error);
  }
}

/**
 * Import all stocks with turbo speed
 * @returns {Promise<void>}
 */
async function importAllStocksTurbo() {
  try {
    console.log('Starting turbo import of all stocks');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Starting turbo import of all stocks');
    
    // Get all tickers
    console.log('Getting all tickers...');
    const tickers = await getAllTickers();
    console.log(`Got ${tickers.length} tickers`);
    
    if (tickers.length === 0) {
      console.error('No tickers found');
      updateImportStatus(IMPORT_STATUS.ERROR, 'No tickers found');
      return;
    }
    
    // Process ticker data
    console.log('Processing ticker data...');
    await processTickerData(tickers);
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.COMPLETED, `Completed import of ${tickers.length} tickers`);
    
    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error in importAllStocksTurbo:', error.message);
    errorLogger.logError(error, 'importAllStocksTurbo');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.ERROR, `Error in import: ${error.message}`, error);
    
    throw error;
  }
}

/**
 * Get import status
 * @returns {Object} - Import status
 */
function getImportStatus() {
  try {
    const statusFile = path.join(__dirname, 'data', 'import_status.json');
    
    if (fs.existsSync(statusFile)) {
      const statusData = fs.readFileSync(statusFile, 'utf8');
      return JSON.parse(statusData);
    }
    
    return {
      status: IMPORT_STATUS.IDLE,
      lastRun: null,
      lastError: null,
      rateLimitReset: null,
      message: 'Import not started'
    };
  } catch (error) {
    console.error('Error getting import status:', error);
    return {
      status: IMPORT_STATUS.ERROR,
      lastRun: new Date().toISOString(),
      lastError: error.message,
      rateLimitReset: null,
      message: 'Error getting import status'
    };
  }
}

module.exports = {
  importAllStocksTurbo,
  getImportStatus
};
