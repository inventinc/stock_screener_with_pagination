/**
 * High-speed import module for Polygon.io stock data
 * This module provides optimized functions for importing all stocks at maximum speed
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

/**
 * Make API request to Polygon.io with minimal delay
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
      
      // Add dynamic backoff for rate limits
      // Track consecutive rate limits to implement exponential backoff
      if (!global.consecutiveRateLimits) {
        global.consecutiveRateLimits = 0;
      }
      global.consecutiveRateLimits++;
      
      // Calculate backoff time: start at 300ms and increase with consecutive rate limits
      const baseDelay = 300;
      const maxDelay = 2000; // Cap at 2 seconds
      const backoffDelay = Math.min(baseDelay * Math.pow(1.5, Math.min(global.consecutiveRateLimits - 1, 5)), maxDelay);
      
      console.log(`Dynamic backoff after rate limit: ${backoffDelay}ms (consecutive: ${global.consecutiveRateLimits})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Add small random jitter to avoid synchronized requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
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
      limit: 200, // Increased batch size for faster import
      type: 'CS' // Common Stock only, excludes ETFs
    };
    
    console.log(`Making initial API request to: ${nextUrl} with params:`, params);
    
    // Only fetch NYSE and NASDAQ stocks (using exchange codes XNYS and XNAS)
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
    // Make API request
    const endpoint = `/v3/reference/tickers/${symbol}`;
    const response = await makeApiRequest(endpoint);
    
    if (response.results) {
      return response.results;
    }
    
    return null;
  } catch (error) {
    console.error('[ERROR] getTickerDetails:', error.message);
    errorLogger.logError(error, 'getTickerDetails', { symbol });
    return null; // Return null instead of throwing to keep the import process moving
  }
}

/**
 * Get stock price from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number>} - Stock price
 */
async function getStockPrice(symbol) {
  try {
    // Make API request
    const endpoint = `/v2/aggs/ticker/${symbol}/prev`;
    const response = await makeApiRequest(endpoint);
    
    if (response.results && response.results.length > 0) {
      const price = response.results[0].c;
      return price;
    }
    
    return null;
  } catch (error) {
    console.error('[ERROR] getStockPrice:', error.message);
    errorLogger.logError(error, 'getStockPrice', { symbol });
    return null; // Return null instead of throwing to keep the import process moving
  }
}

/**
 * Get financial ratios from Polygon.io
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Financial ratios
 */
async function getFinancialRatios(symbol) {
  try {
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
 * Import all stocks at maximum speed
 * @returns {Promise<void>}
 */
async function importAllStocksHighSpeed() {
  try {
    console.log('Starting high-speed stock import');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Starting high-speed stock import');
    
    // Get all tickers
    console.log('Fetching all tickers from Polygon.io at maximum speed');
    const tickers = await getAllTickers();
    
    if (!tickers || tickers.length === 0) {
      console.error('No tickers found');
      updateImportStatus(IMPORT_STATUS.ERROR, 'No tickers found');
      return;
    }
    
    console.log(`Found ${tickers.length} tickers`);
    
    // Create stocks array
    const stocks = [];
    
    // Update batch progress
    const batchProgressFile = path.join(__dirname, 'data', 'batch_progress.json');
    const batchProgress = {
      lastUpdated: new Date().toISOString(),
      currentBatch: 0,
      totalBatches: 1, // Single batch in high-speed mode
      totalSymbols: tickers.length,
      processedSymbols: 0,
      successfulSymbols: 0,
      failedSymbols: 0,
      errors: []
    };
    
    fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
    
    // Process all tickers in parallel with high concurrency
    console.log('Processing all tickers in parallel with high concurrency');
    
    // Maximum concurrency for details, prices, and ratios
    const maxConcurrency = 8; // Balanced concurrency for optimal speed and reliability
    
    // Create a queue for processing
    const queue = [...tickers];
    const processingPromises = [];
    let activePromises = 0;
    
    // Process function
    const processTicker = async (ticker) => {
      try {
        // Get ticker details
        const details = await getTickerDetails(ticker.ticker);
        
        if (!details) {
          batchProgress.failedSymbols++;
          return;
        }
        
        // Get stock price
        const price = await getStockPrice(ticker.ticker);
        
        // Get financial ratios
        const ratios = await getFinancialRatios(ticker.ticker);
        
        // Create stock object
        const stock = {
          symbol: ticker.ticker,
          name: details.name || ticker.name,
          exchange: ticker.primary_exchange || ticker.market,
          sector: details.sic_description || 'Unknown',
          industry: details.standard_industrial_classification?.industry_title || 'Unknown',
          price: price || null,
          marketCap: details.market_cap || null,
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
        
        // Add to stocks array
        stocks.push(stock);
        
        batchProgress.successfulSymbols++;
      } catch (error) {
        console.error(`Error processing ticker ${ticker.ticker}:`, error.message);
        batchProgress.failedSymbols++;
      } finally {
        batchProgress.processedSymbols++;
        activePromises--;
        
        // Log progress every 100 stocks
        if (batchProgress.processedSymbols % 100 === 0) {
          console.log(`Processed ${batchProgress.processedSymbols} of ${tickers.length} stocks (${Math.round(batchProgress.processedSymbols / tickers.length * 100)}%)`);
          
          // Update batch progress file (but don't save stocks yet)
          batchProgress.lastUpdated = new Date().toISOString();
          fs.writeFileSync(batchProgressFile, JSON.stringify(batchProgress, null, 2));
        }
        
        // Process next ticker from queue if available
        if (queue.length > 0) {
          const nextTicker = queue.shift();
          const promise = processTicker(nextTicker).catch(e => console.error('Error in ticker processing:', e));
          processingPromises.push(promise);
          activePromises++;
        }
      }
    };
    
    // Start initial batch of promises
    const initialBatchSize = Math.min(maxConcurrency, queue.length);
    console.log(`Starting initial batch of ${initialBatchSize} concurrent requests`);
    
    for (let i = 0; i < initialBatchSize; i++) {
      const ticker = queue.shift();
      const promise = processTicker(ticker).catch(e => console.error('Error in ticker processing:', e));
      processingPromises.push(promise);
      activePromises++;
    }
    
    // Wait for all processing to complete
    console.log('Waiting for all processing to complete...');
    await Promise.all(processingPromises);
    
    // Save all stocks to file at once at the end
    console.log(`Stock import complete. Saving ${stocks.length} stocks to file...`);
    const stocksFile = path.join(__dirname, 'data', 'all_stocks.json');
    fs.writeFileSync(stocksFile, JSON.stringify(stocks, null, 2));
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.COMPLETED, `High-speed stock import complete. Imported ${stocks.length} stocks.`);
    
    console.log('High-speed stock import complete');
  } catch (error) {
    console.error('Error importing stocks:', error.message);
    errorLogger.logError(error, 'importAllStocksHighSpeed');
    
    // Update import status
    updateImportStatus(IMPORT_STATUS.ERROR, `Error importing stocks: ${error.message}`);
  }
}

module.exports = {
  importAllStocksHighSpeed,
  updateImportStatus,
  IMPORT_STATUS
};
