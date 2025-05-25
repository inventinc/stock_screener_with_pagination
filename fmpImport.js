/**
 * Enhanced FMP Import Script with ROTCE and Cash Conversion Ratio Support
 * 
 * This script extends the original FMP import functionality to fetch additional
 * data points needed for ROTCE and Cash Conversion Ratio calculations.
 */

const axios = require('axios');
const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');
const financialMetricsCalculator = require('./financial_metrics_calculator');
require('dotenv').config();

// Configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const BATCH_SIZE = 25; // Process stocks in batches
const CONCURRENT_REQUESTS = 5; // Number of concurrent API requests
const DELAY_BETWEEN_BATCHES = 1000; // Delay between batches in ms

/**
 * Fetch data from FMP API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response data
 */
async function fetchFMPData(endpoint, params = {}) {
  try {
    const url = `${FMP_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        ...params,
        apikey: FMP_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from ${endpoint}:`, error.message);
    return null;
  }
}

/**
 * Fetch comprehensive financial data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Comprehensive financial data
 */
async function fetchComprehensiveFinancialData(symbol) {
  try {
    // Fetch data in parallel for efficiency
    const [
      profile,
      incomeStatements,
      balanceSheets,
      cashFlowStatements,
      keyMetrics,
      ratios
    ] = await Promise.all([
      fetchFMPData(`/profile/${symbol}`),
      fetchFMPData(`/income-statement/${symbol}`, { limit: 5 }), // 5 years for Cash Conversion
      fetchFMPData(`/balance-sheet-statement/${symbol}`, { limit: 5 }),
      fetchFMPData(`/cash-flow-statement/${symbol}`, { limit: 5 }),
      fetchFMPData(`/key-metrics/${symbol}`, { limit: 1 }),
      fetchFMPData(`/ratios/${symbol}`, { limit: 1 })
    ]);
    
    // Combine all data into a comprehensive financial object
    return {
      profile: profile && profile.length > 0 ? profile[0] : null,
      incomeStatement: incomeStatements || [],
      balanceSheet: balanceSheets || [],
      cashFlowStatement: cashFlowStatements || [],
      keyMetrics: keyMetrics && keyMetrics.length > 0 ? keyMetrics[0] : null,
      ratios: ratios && ratios.length > 0 ? ratios[0] : null
    };
  } catch (error) {
    console.error(`Error fetching comprehensive data for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Process a single stock
 * @param {Object} stockInfo - Basic stock info
 * @returns {Promise<Object>} - Processed stock data
 */
async function processStock(stockInfo) {
  try {
    const { symbol } = stockInfo;
    console.log(`Processing ${symbol}...`);
    
    // Fetch comprehensive financial data
    const financialData = await fetchComprehensiveFinancialData(symbol);
    if (!financialData || !financialData.profile) {
      console.log(`Skipping ${symbol}: No financial data available`);
      return null;
    }
    
    // Extract basic profile data
    const { profile } = financialData;
    
    // Calculate financial metrics (ROTCE and Cash Conversion)
    const financialMetrics = financialMetricsCalculator.calculateFinancialMetrics(financialData);
    
    // Extract key financial ratios
    const ratios = financialData.ratios || {};
    const keyMetrics = financialData.keyMetrics || {};
    
    // Prepare stock data for database
    const stockData = {
      symbol,
      name: profile.companyName,
      exchange: profile.exchangeShortName,
      sector: profile.sector,
      industry: profile.industry,
      price: profile.price,
      marketCap: profile.mktCap,
      beta: profile.beta,
      
      // Financial ratios
      peRatio: ratios.peRatio || profile.pe,
      pbRatio: ratios.priceToBookRatio,
      psRatio: ratios.priceToSalesRatio,
      dividendYield: profile.lastDiv / profile.price,
      
      // Debt metrics
      debtToEquity: ratios.debtToEquity,
      netDebtToEBITDA: ratios.netDebtToEBITDA || ratios.debtToEBITDA,
      
      // Profitability metrics
      returnOnEquity: ratios.returnOnEquity,
      returnOnAssets: ratios.returnOnAssets,
      
      // Custom calculated metrics
      rotce: financialMetrics.rotce.value,
      rotceCalculationMethod: financialMetrics.rotce.method,
      rotceHasAllComponents: financialMetrics.rotce.hasAllComponents,
      
      cashConversion: financialMetrics.cashConversion.value,
      cashConversionYears: financialMetrics.cashConversion.components.yearsAvailable,
      cashConversionHasAllComponents: financialMetrics.cashConversion.hasAllComponents,
      
      // Metadata
      lastUpdated: new Date()
    };
    
    return stockData;
  } catch (error) {
    console.error(`Error processing ${stockInfo.symbol}:`, error.message);
    return null;
  }
}

/**
 * Process a batch of stocks
 * @param {Array} stockBatch - Batch of stocks to process
 * @returns {Promise<Array>} - Processed stock data
 */
async function processBatch(stockBatch) {
  try {
    // Process stocks concurrently with limited concurrency
    const promises = [];
    for (let i = 0; i < stockBatch.length; i += CONCURRENT_REQUESTS) {
      const batchPromises = stockBatch.slice(i, i + CONCURRENT_REQUESTS).map(stock => processStock(stock));
      const results = await Promise.all(batchPromises);
      promises.push(...results);
      
      // Add small delay between sub-batches to avoid rate limiting
      if (i + CONCURRENT_REQUESTS < stockBatch.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Filter out null results
    return promises.filter(result => result !== null);
  } catch (error) {
    console.error('Error processing batch:', error.message);
    return [];
  }
}

/**
 * Save processed stocks to database
 * @param {Array} stocks - Processed stock data
 * @returns {Promise<number>} - Number of stocks saved
 */
async function saveStocksToDatabase(stocks) {
  try {
    let savedCount = 0;
    
    for (const stock of stocks) {
      // Use findOneAndUpdate to upsert
      await Stock.findOneAndUpdate(
        { symbol: stock.symbol },
        stock,
        { upsert: true, new: true }
      );
      savedCount++;
    }
    
    return savedCount;
  } catch (error) {
    console.error('Error saving stocks to database:', error.message);
    return 0;
  }
}

/**
 * Main import function
 * @param {number} limit - Optional limit on number of stocks to import
 * @returns {Promise<Object>} - Import results
 */
async function importStocksWithEnhancedMetrics(limit = 0) {
  try {
    console.log('Starting enhanced FMP import with ROTCE and Cash Conversion support...');
    
    // Connect to database
    await connectDB();
    
    // Fetch stock list from FMP
    console.log('Fetching stock list...');
    const stockList = await fetchFMPData('/stock/list');
    
    if (!stockList || !Array.isArray(stockList)) {
      throw new Error('Failed to fetch stock list');
    }
    
    // Filter to only include stocks from major exchanges
    const filteredStocks = stockList.filter(stock => 
      stock.type === 'stock' && 
      (stock.exchangeShortName === 'NYSE' || 
       stock.exchangeShortName === 'NASDAQ')
    );
    
    // Apply limit if specified
    const stocksToProcess = limit > 0 ? filteredStocks.slice(0, limit) : filteredStocks;
    
    console.log(`Processing ${stocksToProcess.length} stocks...`);
    
    // Process stocks in batches
    let processedStocks = [];
    let totalSaved = 0;
    
    for (let i = 0; i < stocksToProcess.length; i += BATCH_SIZE) {
      const batch = stocksToProcess.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(stocksToProcess.length / BATCH_SIZE)}...`);
      
      const processedBatch = await processBatch(batch);
      const savedCount = await saveStocksToDatabase(processedBatch);
      
      processedStocks.push(...processedBatch);
      totalSaved += savedCount;
      
      console.log(`Batch complete. Saved ${savedCount} stocks.`);
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < stocksToProcess.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    console.log('Import complete!');
    console.log(`Processed ${processedStocks.length} stocks, saved ${totalSaved} to database.`);
    
    // Disconnect from database
    await mongoose.disconnect();
    
    return {
      totalProcessed: processedStocks.length,
      totalSaved,
      success: true
    };
  } catch (error) {
    console.error('Error in import process:', error.message);
    
    // Ensure database connection is closed
    try {
      await mongoose.disconnect();
    } catch (err) {
      console.error('Error disconnecting from database:', err.message);
    }
    
    return {
      error: error.message,
      success: false
    };
  }
}

// Export functions
module.exports = {
  importStocksWithEnhancedMetrics,
  fetchComprehensiveFinancialData,
  processStock
};

// Run import if called directly
if (require.main === module) {
  // Get limit from command line arguments
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 0;
  
  importStocksWithEnhancedMetrics(limit)
    .then(result => {
      console.log('Import result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}
