const fs = require('fs');
const path = require('path');
const errorLogger = require('./errorLogger');
const axios = require('axios');

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

// Cache directory
const cacheDir = path.join(__dirname, 'data', 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Make API request to Polygon.io
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(endpoint, params = {}) {
  try {
    // Add API key to params
    params.apiKey = API_KEY;
    
    // Build URL
    const url = `${BASE_URL}${endpoint}`;
    
    console.log(`Making API request to: ${url} with params:`, params);
    
    // Make request with axios
    const response = await axios.get(url, {
      params: params,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    // Return data immediately
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('[RATE_LIMIT] makeApiRequest: Rate limit exceeded');
      
      // With unlimited plan, we only need a very brief pause
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update status but don't wait
      updateImportStatus(IMPORT_STATUS.RATE_LIMITED, 'Rate limit exceeded, retrying immediately', error);
      
      // Retry request immediately
      return makeApiRequest(endpoint, params);
    } else {
      console.error('[ERROR] makeApiRequest:', error.message);
      errorLogger.logError(error, 'makeApiRequest', { endpoint, params });
      throw error;
    }
  }
}

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {Object|null} - Cached data or null if not found
 */
function getCachedData(key) {
  try {
    const cacheFile = path.join(cacheDir, `${key}.json`);
    
    if (fs.existsSync(cacheFile)) {
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // Check if cache is expired (24 hours)
      const cacheTime = new Date(cacheData.timestamp).getTime();
      const now = Date.now();
      const cacheAge = now - cacheTime;
      
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return cacheData.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading cache:', error.message);
    return null;
  }
}

/**
 * Save data to cache
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 */
function saveToCache(key, data) {
  try {
    const cacheFile = path.join(cacheDir, `${key}.json`);
    
    const cacheData = {
      timestamp: new Date().toISOString(),
      data
    };
    
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error('Error saving to cache:', error.message);
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
      message
    };
    
    // Write to file
    fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Error updating import status:', error);
  }
}

/**
 * Get stock price from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number>} - Stock price
 */
async function getStockPrice(symbol) {
  try {
    // Check cache first
    const cacheKey = `price_${symbol}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Make API request
    const endpoint = `/v2/aggs/ticker/${symbol}/prev`;
    const response = await makeApiRequest(endpoint);
    
    if (response.results && response.results.length > 0) {
      const price = response.results[0].c;
      
      // Save to cache
      saveToCache(cacheKey, price);
      
      return price;
    }
    
    return null;
  } catch (error) {
    if (error.message.includes('rate limit')) {
      console.log('[RATE_LIMIT] getStockPrice:', error.message);
    } else {
      console.error('[ERROR] getStockPrice:', error.message);
    }
    errorLogger.logError(error, 'getStockPrice', { symbol });
    throw error;
  }
}

/**
 * Get all tickers from Polygon.io
 * @returns {Promise<Array>} - Array of ticker objects
 */
async function getAllTickers() {
  try {
    console.log('Starting getAllTickers function');
    
    // Check cache first
    console.log('Checking cache for all_tickers');
    const cachedData = getCachedData('all_tickers');
    if (cachedData) {
      console.log('Found cached ticker data, returning');
      return cachedData;
    }
    
    console.log('No cached ticker data found, fetching from API');
    
    // Make API request
    const tickers = [];
    let nextUrl = `/v3/reference/tickers`;
    let params = {
      market: 'stocks',
      active: true,
      limit: 200, // Increased batch size for faster import
      type: 'CS' // Common Stock only, excludes ETFs
    };
    
    console.log(`Making initial API request to: ${nextUrl} with params:`, params);
    
    // Only fetch NYSE and NASDAQ stocks
    const allowedExchanges = ['NYSE', 'NASDAQ'];
    
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
          !ticker.name.includes('ETF') &&
          !ticker.ticker.includes('-')  // Exclude preferred stocks
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
    const maxConcurrentRequests = 20; // Increased for maximum throughput
    let activePromises = 0;
    
    while (nextUrl) { // No limit on ticker count - get all of them
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
                timeout: 30000 // 30 second timeout
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
                !ticker.name.includes('ETF') &&
                !ticker.ticker.includes('-')  // Exclude preferred stocks
              );
              
              console.log(`Filtered to ${filteredResults.length} NYSE/NASDAQ equities (excluding ETFs) on page ${pageCount}`);
              return filteredResults;
            }
            return [];
          } catch (error) {
            console.error(`Error fetching page ${pageCount}:`, error.message);
            errorLogger.logError(error, 'getAllTickers.pagination', { page: pageCount });
            
            // If it's a rate limit, throw to be handled by the caller
            if (error.response && error.response.status === 429) {
              throw error;
            }
            
            // For other errors, return empty array
            return [];
          }
        };
        
        // Get the next URL before processing this one
        const tempNextUrl = nextUrl;
        
        // Add this page to the queue
        const pagePromise = processPage().then(results => {
          activePromises--;
          return results;
        });
        paginationPromises.push(pagePromise);
        activePromises++;
        
        // Update for next iteration
        pageCount++;
        
        // Make a separate request to get the next URL
        if (tempNextUrl.startsWith('http')) {
          const nextPageResponse = await axios.get(tempNextUrl, {
            params: { apiKey: API_KEY },
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          nextUrl = nextPageResponse.data.next_url;
        } else {
          const nextPageResponse = await makeApiRequest(tempNextUrl);
          nextUrl = nextPageResponse.next_url;
        }
        
        // If we've reached the concurrency limit, wait for some to complete
        if (activePromises >= maxConcurrentRequests) {
          console.log(`Reached max concurrency (${maxConcurrentRequests}), waiting for some requests to complete...`);
          await Promise.race(paginationPromises.map(p => p.catch(() => {})));
        }
        
        // If no more pages, break
        if (!nextUrl) {
          console.log('No more pages available, finishing pagination');
          break;
        }
      } catch (error) {
        console.error(`Error in pagination control:`, error.message);
        errorLogger.logError(error, 'getAllTickers.paginationControl');
        
        // If rate limited, wait briefly then continue
        if (error.response && error.response.status === 429) {
          console.log('Rate limit hit in pagination control, waiting briefly...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Short wait
          continue;
        } else {
          // For other errors, break and process what we have
          break;
        }
      }
    }
    
    // Wait for all pagination promises to resolve
    console.log(`Waiting for all ${paginationPromises.length} pagination requests to complete...`);
    const allResults = await Promise.all(paginationPromises.map(p => p.catch(e => {
      console.error('Error in pagination promise:', e.message);
      return [];
    })));
    
    // Flatten results and add to tickers
    const flattenedResults = allResults.flat();
    console.log(`Received ${flattenedResults.length} tickers from pagination`);
    tickers.push(...flattenedResults);
    
    console.log(`Ticker fetching complete. Total tickers: ${tickers.length}`);
    
    // Save to cache
    saveToCache('all_tickers', tickers);
    
    return tickers;
  } catch (error) {
    console.error('Error in getAllTickers:', error.message);
    errorLogger.logError(error, 'getAllTickers');
    return [];
  }
}

/**
 * Get ticker details from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Ticker details
 */
async function getTickerDetails(symbol) {
  try {
    // Check cache first
    const cacheKey = `details_${symbol}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Make API request
    const endpoint = `/v3/reference/tickers/${symbol}`;
    const response = await makeApiRequest(endpoint);
    
    if (response.results) {
      // Save to cache
      saveToCache(cacheKey, response.results);
      
      return response.results;
    }
    
    return null;
  } catch (error) {
    if (error.message.includes('rate limit')) {
      console.log('[RATE_LIMIT] getTickerDetails:', error.message);
    } else {
      console.error('[ERROR] getTickerDetails:', error.message);
    }
    errorLogger.logError(error, 'getTickerDetails', { symbol });
    throw error;
  }
}

/**
 * Get financial ratios from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Financial ratios
 */
async function getFinancialRatios(symbol) {
  try {
    // Check cache first
    const cacheKey = `ratios_${symbol}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Make API request
    const endpoint = `/v3/reference/financials/${symbol}`;
    const params = {
      limit: 1,
      sort: 'filing_date',
      order: 'desc'
    };
    
    const response = await makeApiRequest(endpoint, params);
    
    if (response.results && response.results.length > 0) {
      // Extract financial ratios
      const financials = response.results[0];
      
      // Calculate ratios
      const ratios = {
        netDebtToEBITDA: financials.ratios?.netDebtToEBITDA || null,
        evToEBIT: financials.ratios?.enterpriseValueToEBIT || null,
        rotce: financials.ratios?.returnOnTangibleEquity || null,
        fcfToNetIncome: financials.ratios?.freeCashFlowToNetIncome || null,
        shareCountGrowth: financials.ratios?.sharesOutstandingGrowth || null,
        incrementalROIC: financials.ratios?.incrementalROIC || null,
        grossMarginTTM: financials.ratios?.grossMarginTTM || null,
        grossMarginGrowth: financials.ratios?.grossMarginGrowth || null,
        hasGrossMarginDecline: financials.ratios?.grossMarginGrowth < 0 || false,
        hasAuditWarnings: financials.hasAuditWarnings || false
      };
      
      // Save to cache - but only if not in high-speed mode
      if (!process.env.HIGH_SPEED_IMPORT) {
        saveToCache(cacheKey, ratios);
      }
      
      return ratios;
    }
    
    return null;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('[RATE_LIMIT] getFinancialRatios:', error.message);
      // With unlimited plan, we just need a very brief pause
      await new Promise(resolve => setTimeout(resolve, 100));
      return getFinancialRatios(symbol); // Retry immediately
    } else {
      console.error('[ERROR] getFinancialRatios:', error.message);
      errorLogger.logError(error, 'getFinancialRatios', { symbol });
      return null; // Return null instead of throwing to keep the import process moving
    }
  }
}

/**
 * Update prices for all stocks
 * @returns {Promise<void>}
 */
async function updatePrices() {
  try {
    console.log('Starting price update');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Updating stock prices');
    
    // Read all stocks
    const stocksFile = path.join(__dirname, 'data', 'all_stocks.json');
    const stocksData = fs.readFileSync(stocksFile, 'utf8');
    const stocks = JSON.parse(stocksData);
    
    console.log(`Updating prices for ${stocks.length} stocks`);
    
    // Update batch progress
    const batchProgressFile = path.join(__dirname, 'data', 'batch_progress.json');
    const batchProgress = {
      lastUpdated: new Date().toISOString(),
      currentBatch: 0,
      totalBatches: 1,
      totalSymbols: stocks.length,
      processedSymbols: 0,
      successfulSymbols: 0,
      failedSymbols: 0,
      errors: []
    };
    
    fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
    
    // Update prices in batches
    const batchSize = 20;
    const batches = [];
    
    for (let i = 0; i < stocks.length; i += batchSize) {
      batches.push(stocks.slice(i, i + batchSize));
    }
    
    console.log(`Created ${batches.length} batches of ${batchSize} stocks each`);
    
    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      console.log(`Processing batch ${i + 1} of ${batches.length}`);
      
      // Update batch progress
      batchProgress.currentBatch = i + 1;
      batchProgress.lastUpdated = new Date().toISOString();
      fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
      
      // Process batch
      const promises = batch.map(async (stock) => {
        try {
          const price = await getStockPrice(stock.symbol);
          
          if (price !== null) {
            stock.price = price;
            batchProgress.successfulSymbols++;
          } else {
            batchProgress.failedSymbols++;
            batchProgress.errors.push({
              symbol: stock.symbol,
              error: 'Failed to get price',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          batchProgress.failedSymbols++;
          batchProgress.errors.push({
            symbol: stock.symbol,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
        
        batchProgress.processedSymbols++;
      });
      
      // Wait for all promises to resolve
      await Promise.all(promises);
      
      // Update batch progress
      batchProgress.lastUpdated = new Date().toISOString();
      fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
      
      // Save updated stocks
      fs.writeFileSync(stocksFile, JSON.stringify(stocks, null, 2));
      
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Price update complete');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.COMPLETED, 'Price update complete');
  } catch (error) {
    console.error('Error updating prices:', error.message);
    errorLogger.logError(error, 'updatePrices');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.ERROR, 'Error updating prices', error);
  }
}

/**
 * Import stocks from Polygon.io
 * @returns {Promise<void>}
 */
async function importStocks() {
  try {
    console.log('Starting stock import');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Fetching tickers from Polygon.io');
    
    // Get all tickers
    const tickers = await getAllTickers();
    
    console.log(`Fetched ${tickers.length} tickers`);
    
    // Filter for NYSE and NASDAQ only
    const allowedExchanges = ['NYSE', 'NASDAQ'];
    const filteredTickers = tickers.filter(ticker => 
      allowedExchanges.includes(ticker.market) || 
      allowedExchanges.includes(ticker.primary_exchange)
    );
    
    console.log(`Filtered to ${filteredTickers.length} NYSE/NASDAQ tickers`);
    
    // Create batches
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < filteredTickers.length; i += batchSize) {
      batches.push(filteredTickers.slice(i, i + batchSize));
    }
    
    console.log(`Created ${batches.length} batches of ${batchSize} tickers each`);
    
    // Update batch progress
    const batchProgressFile = path.join(__dirname, 'data', 'batch_progress.json');
    const batchProgress = {
      lastUpdated: new Date().toISOString(),
      currentBatch: 0,
      totalBatches: batches.length,
      totalSymbols: filteredTickers.length,
      processedSymbols: 0,
      successfulSymbols: 0,
      failedSymbols: 0,
      errors: []
    };
    
    fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
    
    // Process batches
    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], i, batches.length, batchProgress, batchProgressFile);
    }
    
    console.log('Stock import complete');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.COMPLETED, 'Stock import complete');
  } catch (error) {
    console.error('Error importing stocks:', error.message);
    errorLogger.logError(error, 'importStocks');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.ERROR, 'Error importing stocks', error);
  }
}

/**
 * Process batch of tickers
 * @param {Array} batch - Batch of tickers
 * @param {number} batchIndex - Batch index
 * @param {number} totalBatches - Total number of batches
 * @param {Object} batchProgress - Batch progress object
 * @param {string} batchProgressFile - Batch progress file path
 * @returns {Promise<void>}
 */
async function processBatch(batch, batchIndex, totalBatches, batchProgress, batchProgressFile) {
  try {
    console.log(`Processing batch ${batchIndex + 1} of ${totalBatches}`);
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.RUNNING, `Processing batch ${batchIndex + 1} of ${totalBatches}`);
    
    // Update batch progress
    batchProgress.currentBatch = batchIndex + 1;
    batchProgress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
    
    // Read existing stocks
    const stocksFile = path.join(__dirname, 'data', 'all_stocks.json');
    let stocks = [];
    
    if (fs.existsSync(stocksFile)) {
      const stocksData = fs.readFileSync(stocksFile, 'utf8');
      stocks = JSON.parse(stocksData);
    }
    
    // Process batch
    const newStocks = [];
    
    for (const ticker of batch) {
      try {
        // Check if stock already exists
        const existingStock = stocks.find(s => s.symbol === ticker.symbol);
        
        if (existingStock) {
          console.log(`Stock ${ticker.symbol} already exists, skipping`);
          batchProgress.processedSymbols++;
          batchProgress.successfulSymbols++;
          continue;
        }
        
        console.log(`Processing ticker ${ticker.symbol}`);
        
        // Get ticker details
        const details = await getTickerDetails(ticker.symbol);
        
        // Get stock price
        const price = await getStockPrice(ticker.symbol);
        
        // Get financial ratios
        const ratios = await getFinancialRatios(ticker.symbol);
        
        // Create stock object
        const stock = {
          symbol: ticker.symbol,
          name: ticker.name,
          exchange: ticker.primary_exchange || ticker.market,
          price: price,
          marketCap: details?.market_cap || null,
          sector: details?.sic_description || null,
          industry: details?.standard_industrial_classification?.industry_title || null,
          avgDollarVolume: ticker.weighted_shares_outstanding ? ticker.weighted_shares_outstanding * price : null,
          netDebtToEBITDA: ratios?.netDebtToEBITDA || null,
          evToEBIT: ratios?.evToEBIT || null,
          rotce: ratios?.rotce || null,
          fcfToNetIncome: ratios?.fcfToNetIncome || null,
          shareCountGrowth: ratios?.shareCountGrowth || null,
          incrementalROIC: ratios?.incrementalROIC || null,
          isDeepValue: false, // Calculated field
          hasMoat: false, // Calculated field
          insiderOwnership: null, // To be populated
          insidersAreBuying: false, // To be populated
          hasGrossMarginDecline: ratios?.hasGrossMarginDecline || false,
          hasAuditWarnings: ratios?.hasAuditWarnings || false,
          lastUpdated: new Date().toISOString()
        };
        
        // Add to new stocks
        newStocks.push(stock);
        
        // Update batch progress
        batchProgress.processedSymbols++;
        batchProgress.successfulSymbols++;
      } catch (error) {
        console.error(`Error processing ticker ${ticker.symbol}:`, error.message);
        
        // Update batch progress
        batchProgress.processedSymbols++;
        batchProgress.failedSymbols++;
        batchProgress.errors.push({
          symbol: ticker.symbol,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Log error
        errorLogger.logError(error, 'processBatch', { symbol: ticker.symbol });
      }
      
      // Update batch progress file
      batchProgress.lastUpdated = new Date().toISOString();
      fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
    }
    
    console.log(`Processed ${newStocks.length} new stocks in batch ${batchIndex + 1}`);
    
    // Add new stocks to existing stocks
    stocks = [...stocks, ...newStocks];
    
    // Save updated stocks
    fs.writeFileSync(stocksFile, JSON.stringify(stocks, null, 2));
    
    console.log(`Saved ${stocks.length} total stocks to file`);
    
    // Wait a bit to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`Error processing batch ${batchIndex + 1}:`, error.message);
    errorLogger.logError(error, 'processBatch', { batchIndex });
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.ERROR, `Error processing batch ${batchIndex + 1}`, error);
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
      const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      return statusData;
    }
    
    return {
      status: 'idle',
      lastRun: null,
      lastError: null,
      rateLimitReset: null,
      message: 'Import not started'
    };
  } catch (error) {
    console.error('Error getting import status:', error.message);
    return {
      status: 'error',
      lastRun: new Date().toISOString(),
      lastError: error.message,
      rateLimitReset: null,
      message: 'Error getting import status'
    };
  }
}

// Export functions
module.exports = {
  makeApiRequest,
  getStockPrice,
  getAllTickers,
  getTickerDetails,
  getFinancialRatios,
  updatePrices,
  importStocks,
  processBatch,
  getImportStatus,
  updateImportStatus,
  IMPORT_STATUS
};
