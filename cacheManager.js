const fs = require('fs');
const path = require('path');
const axios = require('axios');
const errorLogger = require('./errorLogger');

// Cache directory
const cacheDir = path.join(__dirname, 'data', 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Data files
const DATA_DIR = path.join(__dirname, 'data');
const ALL_STOCKS_FILE = path.join(DATA_DIR, 'all_stocks.json');
const BATCH_PROGRESS_FILE = path.join(DATA_DIR, 'batch_progress.json');
const IMPORT_STATUS_FILE = path.join(DATA_DIR, 'import_status.json');

// API key
const API_KEY = '682957d18d8522.73412549';

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Import status constants
const IMPORT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited',
  COMPLETED: 'completed'
};

// Initialize import status
if (!fs.existsSync(IMPORT_STATUS_FILE)) {
  fs.writeFileSync(IMPORT_STATUS_FILE, JSON.stringify({
    status: IMPORT_STATUS.IDLE,
    lastRun: null,
    lastError: null,
    rateLimitReset: null,
    message: 'Import not started'
  }));
}

// Get stock data from cache
function getStockData(symbol) {
  try {
    const cacheFile = path.join(cacheDir, `${symbol}.json`);
    
    // Check if cache file exists
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    // Read cache file
    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    
    // Check if cache is expired
    const cacheTime = new Date(cacheData.cacheTime).getTime();
    const currentTime = new Date().getTime();
    
    if (currentTime - cacheTime > CACHE_EXPIRATION) {
      // Cache is expired
      return null;
    }
    
    // Return cached data
    return cacheData.data;
  } catch (error) {
    errorLogger.logError(error, 'getStockData', { symbol });
    return null;
  }
}

// Save stock data to cache
function saveStockData(symbol, data) {
  try {
    const cacheFile = path.join(cacheDir, `${symbol}.json`);
    
    // Create cache object
    const cacheData = {
      cacheTime: new Date().toISOString(),
      data
    };
    
    // Write to cache file
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData));
  } catch (error) {
    errorLogger.logError(error, 'saveStockData', { symbol });
  }
}

// Clear expired cache entries
function clearExpiredCache() {
  try {
    const files = fs.readdirSync(cacheDir);
    const currentTime = new Date().getTime();
    
    for (const file of files) {
      const cacheFile = path.join(cacheDir, file);
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      const cacheTime = new Date(cacheData.cacheTime).getTime();
      
      if (currentTime - cacheTime > CACHE_EXPIRATION) {
        // Delete expired cache file
        fs.unlinkSync(cacheFile);
      }
    }
  } catch (error) {
    errorLogger.logError(error, 'clearExpiredCache');
  }
}

// Clear all cache
function clearAllCache() {
  try {
    const files = fs.readdirSync(cacheDir);
    
    for (const file of files) {
      const cacheFile = path.join(cacheDir, file);
      fs.unlinkSync(cacheFile);
    }
  } catch (error) {
    errorLogger.logError(error, 'clearAllCache');
  }
}

// Update import status
function updateImportStatus(status, message = null, error = null) {
  try {
    const currentStatus = JSON.parse(fs.readFileSync(IMPORT_STATUS_FILE, 'utf8'));
    
    const newStatus = {
      ...currentStatus,
      status,
      lastRun: new Date().toISOString(),
      message: message || currentStatus.message
    };
    
    if (error) {
      newStatus.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
        category: error.category || errorLogger.categorizeError(error)
      };
    }
    
    if (status === IMPORT_STATUS.RATE_LIMITED && error && error.response) {
      // Extract rate limit reset time from headers if available
      const resetTime = error.response.headers['x-ratelimit-reset'];
      if (resetTime) {
        newStatus.rateLimitReset = new Date(parseInt(resetTime) * 1000).toISOString();
      } else {
        // Default to 5 minutes if header not available
        const resetDate = new Date();
        resetDate.setMinutes(resetDate.getMinutes() + 5);
        newStatus.rateLimitReset = resetDate.toISOString();
      }
    }
    
    fs.writeFileSync(IMPORT_STATUS_FILE, JSON.stringify(newStatus));
    return newStatus;
  } catch (error) {
    console.error('Error updating import status:', error);
    return null;
  }
}

// Get current import status
function getImportStatus() {
  try {
    return JSON.parse(fs.readFileSync(IMPORT_STATUS_FILE, 'utf8'));
  } catch (error) {
    errorLogger.logError(error, 'getImportStatus');
    return {
      status: IMPORT_STATUS.ERROR,
      lastRun: new Date().toISOString(),
      lastError: {
        message: 'Failed to read import status file',
        timestamp: new Date().toISOString()
      },
      message: 'Error reading import status'
    };
  }
}

// Import stocks from API - OPTIMIZED FOR SPEED AND RELIABILITY
async function importStocks() {
  try {
    console.log('Starting stock import process...');
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Starting import process');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Initialize batch progress
    let batchProgress = {
      lastUpdated: new Date().toISOString(),
      currentBatch: 0,
      totalBatches: 0,
      totalSymbols: 0,
      processedSymbols: 0,
      successfulSymbols: 0,
      failedSymbols: 0,
      errors: []
    };
    
    // Save initial batch progress
    fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
    
    // Get all symbols for US exchanges
    console.log('Fetching symbols for US exchanges...');
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Fetching symbols from exchange');
    
    let symbolsResponse;
    try {
      symbolsResponse = await axios.get(`https://eodhd.com/api/exchange-symbol-list/US?api_token=${API_KEY}&fmt=json`);
    } catch (error) {
      // Handle rate limiting specifically
      if (error.response && error.response.status === 429) {
        errorLogger.logError(error, 'importStocks.fetchSymbols', { rateLimited: true });
        updateImportStatus(IMPORT_STATUS.RATE_LIMITED, 'API rate limit exceeded while fetching symbols', error);
        return false;
      }
      
      // Handle other errors
      errorLogger.logError(error, 'importStocks.fetchSymbols');
      updateImportStatus(IMPORT_STATUS.ERROR, 'Failed to fetch symbols from exchange', error);
      return false;
    }
    
    // Filter for NYSE and NASDAQ equities only
    const allSymbols = symbolsResponse.data.filter(symbol => 
      (symbol.Exchange === 'NYSE' || symbol.Exchange === 'NASDAQ') && 
      symbol.Type === 'Common Stock'
    );
    
    console.log(`Total symbols to process: ${allSymbols.length}`);
    updateImportStatus(IMPORT_STATUS.RUNNING, `Found ${allSymbols.length} NYSE and NASDAQ equities to import`);
    
    // Update batch progress
    batchProgress.totalSymbols = allSymbols.length;
    
    // OPTIMIZED BATCH SIZE - balance between speed and reliability
    const batchSize = 75; // Increased from 50 to 75
    batchProgress.totalBatches = Math.ceil(allSymbols.length / batchSize);
    fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
    
    // Process symbols in batches
    const batches = [];
    
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      batches.push(allSymbols.slice(i, i + batchSize));
    }
    
    // Initialize or read existing all_stocks.json
    let existingStocks = [];
    try {
      if (fs.existsSync(ALL_STOCKS_FILE)) {
        const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
        existingStocks = JSON.parse(stocksData);
        console.log(`Found ${existingStocks.length} existing stocks in all_stocks.json`);
      }
    } catch (error) {
      errorLogger.logError(error, 'importStocks.readExistingStocks');
      console.log('Error reading existing stocks, starting with empty array');
      existingStocks = [];
    }
    
    // Write initial stocks file if it doesn't exist
    if (!fs.existsSync(ALL_STOCKS_FILE)) {
      fs.writeFileSync(ALL_STOCKS_FILE, JSON.stringify(existingStocks));
    }
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1} of ${batches.length}...`);
      updateImportStatus(IMPORT_STATUS.RUNNING, `Processing batch ${batchIndex + 1} of ${batches.length}`);
      
      // Update batch progress
      batchProgress.currentBatch = batchIndex + 1;
      batchProgress.lastUpdated = new Date().toISOString();
      fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
      
      // Process each symbol in the batch with OPTIMIZED CONCURRENCY
      const concurrencyLimit = 5; // Increased from 3 to 5
      const results = [];
      const batchErrors = [];
      
      for (let i = 0; i < batch.length; i += concurrencyLimit) {
        const symbolBatch = batch.slice(i, i + concurrencyLimit);
        const promises = symbolBatch.map(async (symbol) => {
          try {
            // Skip if symbol already exists in the database
            const existingStock = existingStocks.find(s => s.symbol === symbol.Code);
            if (existingStock) {
              console.log(`Symbol ${symbol.Code} already exists, skipping`);
              batchProgress.processedSymbols++;
              batchProgress.successfulSymbols++;
              return existingStock;
            }
            
            // Get fundamental data
            const fundamentalData = await getStockFundamentals(symbol.Code);
            
            // Get price data
            const priceData = await getStockPrice(symbol.Code);
            
            // Combine data
            const stockData = {
              symbol: symbol.Code,
              name: symbol.Name,
              exchange: symbol.Exchange,
              sector: fundamentalData?.General?.Sector || null,
              industry: fundamentalData?.General?.Industry || null,
              marketCap: fundamentalData?.Highlights?.MarketCapitalization || null,
              avgDollarVolume: fundamentalData?.Highlights?.AverageDailyVolume || null,
              netDebtToEBITDA: fundamentalData?.Highlights?.NetDebtToEBITDA || null,
              rotce: fundamentalData?.Highlights?.ReturnOnTangibleEquity || null,
              fcfToNetIncome: fundamentalData?.Highlights?.FreeCashFlowToNetIncome || null,
              shareCountGrowth: fundamentalData?.Highlights?.SharesOutstandingGrowth || null,
              evToEBIT: fundamentalData?.Valuation?.EnterpriseValueToEBIT || null,
              isDeepValue: false,
              hasMoat: false,
              insiderOwnership: fundamentalData?.SharesStats?.InsiderOwnership || null,
              insidersAreBuying: false,
              hasGrossMarginDecline: false,
              incrementalROIC: null,
              hasAuditWarnings: false,
              score: Math.random() * 100, // Placeholder score
              price: priceData?.close || null
            };
            
            batchProgress.processedSymbols++;
            batchProgress.successfulSymbols++;
            
            return stockData;
          } catch (error) {
            // Handle rate limiting
            if (error.response && error.response.status === 429) {
              errorLogger.logError(error, 'importStocks.processSymbol', { symbol: symbol.Code, rateLimited: true });
              updateImportStatus(IMPORT_STATUS.RATE_LIMITED, `API rate limit exceeded while processing ${symbol.Code}`, error);
              
              // Add to batch errors
              batchErrors.push({
                symbol: symbol.Code,
                error: 'Rate limit exceeded',
                timestamp: new Date().toISOString()
              });
              
              // Pause processing for a while
              await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute pause
              
              batchProgress.processedSymbols++;
              batchProgress.failedSymbols++;
              return null;
            }
            
            // Handle other errors
            errorLogger.logError(error, 'importStocks.processSymbol', { symbol: symbol.Code });
            
            // Add to batch errors
            batchErrors.push({
              symbol: symbol.Code,
              error: error.message,
              timestamp: new Date().toISOString()
            });
            
            batchProgress.processedSymbols++;
            batchProgress.failedSymbols++;
            return null;
          }
        });
        
        try {
          // Wait for all promises to resolve
          const batchResults = await Promise.all(promises);
          results.push(...batchResults.filter(Boolean));
        } catch (error) {
          errorLogger.logError(error, 'importStocks.batchProcessing', { batchIndex, startIndex: i });
        }
        
        // Update batch progress with errors
        batchProgress.errors = [...batchProgress.errors, ...batchErrors].slice(-50); // Keep last 50 errors
        batchProgress.lastUpdated = new Date().toISOString();
        fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
        
        // ADAPTIVE DELAY based on error rate
        const errorRate = batchErrors.length / symbolBatch.length;
        let delay = 1000; // Base delay 1 second
        
        if (errorRate > 0.5) {
          delay = 5000; // High error rate, slow down significantly
        } else if (errorRate > 0.2) {
          delay = 3000; // Moderate error rate, slow down moderately
        } else if (batchErrors.some(e => e.error.includes('rate limit'))) {
          delay = 10000; // Rate limit hit, slow down a lot
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Read current stocks again to handle concurrent updates
      let allStocks = [];
      try {
        const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
        allStocks = JSON.parse(stocksData);
      } catch (error) {
        errorLogger.logError(error, 'importStocks.readAllStocks', { batchIndex });
        allStocks = existingStocks; // Fall back to the previously read stocks
      }
      
      // Add new stocks, avoiding duplicates
      const newStocks = results.filter(newStock => 
        !allStocks.some(existingStock => existingStock.symbol === newStock.symbol)
      );
      
      allStocks.push(...newStocks);
      
      // Save updated stocks with error handling
      try {
        // Write to temporary file first
        const tempFile = `${ALL_STOCKS_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(allStocks));
        
        // Rename temp file to actual file (atomic operation)
        fs.renameSync(tempFile, ALL_STOCKS_FILE);
        
        console.log(`Saved ${allStocks.length} stocks to all_stocks.json (added ${newStocks.length} new stocks)`);
        existingStocks = allStocks; // Update our reference
      } catch (error) {
        errorLogger.logError(error, 'importStocks.saveAllStocks', { batchIndex });
        updateImportStatus(IMPORT_STATUS.ERROR, 'Error saving stocks data', error);
      }
      
      // ADAPTIVE BATCH DELAY based on batch success
      const batchSuccessRate = results.length / batch.length;
      let batchDelay = 5000; // Base delay 5 seconds
      
      if (batchSuccessRate < 0.5) {
        batchDelay = 15000; // Low success rate, slow down significantly
      } else if (batchSuccessRate < 0.8) {
        batchDelay = 10000; // Moderate success rate, slow down moderately
      }
      
      await new Promise(resolve => setTimeout(resolve, batchDelay));
      
      // Check if we should continue or stop due to excessive errors
      if (batchProgress.failedSymbols > batchProgress.successfulSymbols * 2) {
        console.log('Too many failures, pausing import process');
        updateImportStatus(IMPORT_STATUS.ERROR, 'Import paused due to excessive failures');
        return false;
      }
    }
    
    console.log('Stock import process completed.');
    updateImportStatus(IMPORT_STATUS.COMPLETED, 'Import process completed successfully');
    
    // Update final batch progress
    batchProgress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
    
    return true;
  } catch (error) {
    errorLogger.logError(error, 'importStocks.main');
    updateImportStatus(IMPORT_STATUS.ERROR, 'Unexpected error in import process', error);
    return false;
  }
}

// Get stock fundamentals from API
async function getStockFundamentals(symbol) {
  try {
    // Check cache first
    const cachedData = getStockData(`${symbol}_fundamentals`);
    if (cachedData) {
      return cachedData;
    }
    
    // Fetch from API
    const response = await axios.get(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json`);
    
    // Save to cache
    saveStockData(`${symbol}_fundamentals`, response.data);
    
    return response.data;
  } catch (error) {
    // Log error with context
    errorLogger.logError(error, 'getStockFundamentals', { symbol });
    
    // Rethrow to be handled by caller
    throw error;
  }
}

// Get stock price from API
async function getStockPrice(symbol) {
  try {
    // Check cache first
    const cachedData = getStockData(`${symbol}_price`);
    if (cachedData) {
      return cachedData;
    }
    
    // Fetch from API
    const response = await axios.get(`https://eodhd.com/api/real-time/${symbol}.US?api_token=${API_KEY}&fmt=json`);
    
    // Save to cache
    saveStockData(`${symbol}_price`, response.data);
    
    return response.data;
  } catch (error) {
    // Log error with context
    errorLogger.logError(error, 'getStockPrice', { symbol });
    
    // Rethrow to be handled by caller
    throw error;
  }
}

// Update prices for all stocks - OPTIMIZED FOR SPEED AND RELIABILITY
async function updatePrices() {
  try {
    console.log('Starting price update process...');
    updateImportStatus(IMPORT_STATUS.RUNNING, 'Updating stock prices');
    
    // Read all stocks
    let allStocks = [];
    try {
      const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
      allStocks = JSON.parse(stocksData);
    } catch (error) {
      errorLogger.logError(error, 'updatePrices.readAllStocks');
      updateImportStatus(IMPORT_STATUS.ERROR, 'Failed to read stocks data for price update', error);
      return false;
    }
    
    // OPTIMIZED BATCH SIZE
    const batchSize = 15; // Increased from 10 to 15
    const batches = [];
    
    for (let i = 0; i < allStocks.length; i += batchSize) {
      batches.push(allStocks.slice(i, i + batchSize));
    }
    
    // Track update statistics
    const updateStats = {
      total: allStocks.length,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Updating prices for batch ${batchIndex + 1} of ${batches.length}...`);
      updateImportStatus(IMPORT_STATUS.RUNNING, `Updating prices: batch ${batchIndex + 1} of ${batches.length}`);
      
      // Process each symbol in the batch with increased concurrency
      const concurrencyLimit = 5; // Increased concurrency
      const batchErrors = [];
      
      for (let i = 0; i < batch.length; i += concurrencyLimit) {
        const symbolBatch = batch.slice(i, i + concurrencyLimit);
        const promises = symbolBatch.map(async (stock) => {
          try {
            // Get price data
            const priceData = await getStockPrice(stock.symbol);
            
            // Update price
            if (priceData) {
              stock.price = priceData.close || stock.price;
              updateStats.updated++;
            }
            
            return stock;
          } catch (error) {
            // Handle rate limiting
            if (error.response && error.response.status === 429) {
              errorLogger.logError(error, 'updatePrices.processSymbol', { symbol: stock.symbol, rateLimited: true });
              updateImportStatus(IMPORT_STATUS.RATE_LIMITED, `API rate limit exceeded while updating price for ${stock.symbol}`, error);
              
              // Add to batch errors
              batchErrors.push({
                symbol: stock.symbol,
                error: 'Rate limit exceeded',
                timestamp: new Date().toISOString()
              });
              
              // Pause processing for a while
              await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second pause
            } else {
              errorLogger.logError(error, 'updatePrices.processSymbol', { symbol: stock.symbol });
              
              // Add to batch errors
              batchErrors.push({
                symbol: stock.symbol,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
            
            updateStats.failed++;
            return stock; // Return unchanged stock
          }
        });
        
        try {
          // Wait for all promises to resolve
          const updatedBatch = await Promise.all(promises);
          
          // Update stocks in the original array
          for (let j = 0; j < updatedBatch.length; j++) {
            const index = batchIndex * batchSize + i + j;
            if (index < allStocks.length) {
              allStocks[index] = updatedBatch[j];
            }
          }
        } catch (error) {
          errorLogger.logError(error, 'updatePrices.batchProcessing', { batchIndex, startIndex: i });
        }
        
        // Update error stats
        updateStats.errors = [...updateStats.errors, ...batchErrors].slice(-50); // Keep last 50 errors
        
        // ADAPTIVE DELAY based on error rate
        const errorRate = batchErrors.length / symbolBatch.length;
        let delay = 1000; // Base delay 1 second
        
        if (errorRate > 0.5) {
          delay = 5000; // High error rate, slow down significantly
        } else if (errorRate > 0.2) {
          delay = 2000; // Moderate error rate, slow down moderately
        } else if (batchErrors.some(e => e.error.includes('rate limit'))) {
          delay = 10000; // Rate limit hit, slow down a lot
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Save progress periodically
      if (batchIndex % 3 === 0 || batchIndex === batches.length - 1) {
        try {
          // Write to temporary file first
          const tempFile = `${ALL_STOCKS_FILE}.tmp`;
          fs.writeFileSync(tempFile, JSON.stringify(allStocks));
          
          // Rename temp file to actual file (atomic operation)
          fs.renameSync(tempFile, ALL_STOCKS_FILE);
          
          console.log(`Saved progress after batch ${batchIndex + 1}, updated ${updateStats.updated} prices`);
        } catch (error) {
          errorLogger.logError(error, 'updatePrices.saveProgress', { batchIndex });
        }
      }
      
      // ADAPTIVE BATCH DELAY based on error rate
      const batchErrorRate = batchErrors.length / batch.length;
      let batchDelay = 2000; // Base delay 2 seconds
      
      if (batchErrorRate > 0.5) {
        batchDelay = 8000; // High error rate, slow down significantly
      } else if (batchErrorRate > 0.2) {
        batchDelay = 5000; // Moderate error rate, slow down moderately
      }
      
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
    
    // Final save of updated stocks
    try {
      fs.writeFileSync(ALL_STOCKS_FILE, JSON.stringify(allStocks));
      console.log(`Price update completed. Updated ${updateStats.updated} of ${updateStats.total} prices.`);
    } catch (error) {
      errorLogger.logError(error, 'updatePrices.finalSave');
      updateImportStatus(IMPORT_STATUS.ERROR, 'Error saving final price updates', error);
      return false;
    }
    
    // Update batch progress
    try {
      const batchProgress = JSON.parse(fs.readFileSync(BATCH_PROGRESS_FILE, 'utf8'));
      batchProgress.lastUpdated = new Date().toISOString();
      fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify(batchProgress));
    } catch (error) {
      errorLogger.logError(error, 'updatePrices.updateBatchProgress');
    }
    
    updateImportStatus(IMPORT_STATUS.COMPLETED, 'Price update completed successfully');
    console.log('Price update process completed.');
    
    return true;
  } catch (error) {
    errorLogger.logError(error, 'updatePrices.main');
    updateImportStatus(IMPORT_STATUS.ERROR, 'Unexpected error in price update process', error);
    return false;
  }
}

// Get import diagnostics
function getImportDiagnostics() {
  try {
    const diagnostics = {
      status: getImportStatus(),
      progress: null,
      recentErrors: errorLogger.getRecentErrors(null, 20),
      errorStats: errorLogger.getErrorStats(),
      stockCount: 0
    };
    
    // Get batch progress
    try {
      if (fs.existsSync(BATCH_PROGRESS_FILE)) {
        diagnostics.progress = JSON.parse(fs.readFileSync(BATCH_PROGRESS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading batch progress:', error);
    }
    
    // Get stock count
    try {
      if (fs.existsSync(ALL_STOCKS_FILE)) {
        const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
        const stocks = JSON.parse(stocksData);
        diagnostics.stockCount = stocks.length;
      }
    } catch (error) {
      console.error('Error reading stocks count:', error);
    }
    
    return diagnostics;
  } catch (error) {
    console.error('Error getting import diagnostics:', error);
    return { error: error.message };
  }
}

// Export functions
module.exports = {
  getStockData,
  saveStockData,
  clearExpiredCache,
  clearAllCache,
  importStocks,
  updatePrices,
  getImportStatus,
  updateImportStatus,
  getImportDiagnostics,
  IMPORT_STATUS
};
