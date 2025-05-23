/**
 * MongoDB data access layer for stock operations with updated exchange handling
 * Provides CRUD operations and query builders for stock data
 */

const Stock = require('./models/Stock');
const { logError } = require('../errorLogger');

/**
 * Create a new stock or update if it already exists
 * @param {Object} stockData - Stock data to create or update
 * @returns {Promise<Object>} Created or updated stock document
 */
const createOrUpdateStock = async (stockData) => {
  try {
    // Normalize exchange code before saving
    if (stockData.exchange) {
      stockData.exchange = normalizeExchangeCode(stockData.exchange);
    }
    
    // Use findOneAndUpdate with upsert to create or update
    const stock = await Stock.findOneAndUpdate(
      { symbol: stockData.symbol },
      { $set: { ...stockData, lastUpdated: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );
    return stock;
  } catch (error) {
    logError('Error creating/updating stock:', error);
    throw error;
  }
};

/**
 * Create or update multiple stocks in bulk
 * @param {Array<Object>} stocksData - Array of stock data objects
 * @returns {Promise<Array>} Results of bulk operation
 */
const bulkCreateOrUpdateStocks = async (stocksData) => {
  try {
    if (!Array.isArray(stocksData) || stocksData.length === 0) {
      return [];
    }

    // Prepare bulk operations with normalized exchange codes
    const bulkOps = stocksData.map(stock => {
      // Create a copy to avoid modifying the original
      const stockCopy = { ...stock };
      
      // Normalize exchange code
      if (stockCopy.exchange) {
        stockCopy.exchange = normalizeExchangeCode(stockCopy.exchange);
      }
      
      return {
        updateOne: {
          filter: { symbol: stockCopy.symbol },
          update: { $set: { ...stockCopy, lastUpdated: new Date() } },
          upsert: true
        }
      };
    });

    // Execute bulk operation
    const result = await Stock.bulkWrite(bulkOps);
    return result;
  } catch (error) {
    logError('Error in bulk stock update:', error);
    throw error;
  }
};

/**
 * Get all stocks with optional filtering
 * @param {Object} filters - Query filters
 * @param {Object} options - Query options (sort, limit, skip)
 * @returns {Promise<Array>} Array of stock documents
 */
const getStocks = async (filters = {}, options = {}) => {
  try {
    // Build query from filters
    const query = buildQuery(filters);
    
    // Apply sorting, pagination
    const { sort = { symbol: 1 }, limit = 0, skip = 0 } = options;
    
    // Execute query
    const stocks = await Stock.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
      
    return stocks;
  } catch (error) {
    logError('Error getting stocks:', error);
    throw error;
  }
};

/**
 * Get stock by symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Stock document
 */
const getStockBySymbol = async (symbol) => {
  try {
    return await Stock.findBySymbol(symbol);
  } catch (error) {
    logError(`Error getting stock by symbol ${symbol}:`, error);
    throw error;
  }
};

/**
 * Get stock statistics (count by exchange, total, etc.)
 * @returns {Promise<Object>} Statistics object
 */
const getStockStats = async () => {
  try {
    // Count total stocks
    const total = await Stock.countDocuments({});
    
    // Count NYSE stocks (accounting for different exchange code formats)
    const nyse = await Stock.countDocuments({ 
      $or: [
        { exchange: 'XNYS' },
        { exchange: 'NYSE' }
      ]
    });
    
    // Count NASDAQ stocks (accounting for different exchange code formats)
    const nasdaq = await Stock.countDocuments({ 
      $or: [
        { exchange: 'XNAS' },
        { exchange: 'NASDAQ' }
      ]
    });
    
    // Get last updated timestamp
    const lastUpdatedDoc = await Stock.findOne().sort({ lastUpdated: -1 }).select('lastUpdated');
    
    return {
      total,
      nyse,
      nasdaq,
      lastUpdated: lastUpdatedDoc ? lastUpdatedDoc.lastUpdated : null
    };
  } catch (error) {
    logError('Error getting stock stats:', error);
    throw error;
  }
};

/**
 * Delete a stock by symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Deletion result
 */
const deleteStock = async (symbol) => {
  try {
    return await Stock.deleteOne({ symbol: symbol.toUpperCase() });
  } catch (error) {
    logError(`Error deleting stock ${symbol}:`, error);
    throw error;
  }
};

/**
 * Normalize exchange code to standard format
 * @param {string} exchange - Exchange code to normalize
 * @returns {string} Normalized exchange code
 */
const normalizeExchangeCode = (exchange) => {
  if (!exchange) return exchange;
  
  const code = exchange.toUpperCase();
  
  // Map common exchange codes to standard format
  switch (code) {
    case 'NYSE':
    case 'XNYS':
      return 'XNYS';
    case 'NASDAQ':
    case 'XNAS':
      return 'XNAS';
    default:
      return exchange;
  }
};

/**
 * Build MongoDB query from filter parameters
 * @param {Object} filters - Filter parameters
 * @returns {Object} MongoDB query object
 */
const buildQuery = (filters) => {
  const query = {};
  
  // Process market cap filter
  if (filters.marketCap) {
    query.marketCap = {};
    if (filters.marketCap.min !== undefined && filters.marketCap.min !== null) {
      query.marketCap.$gte = filters.marketCap.min;
    }
    if (filters.marketCap.max !== undefined && filters.marketCap.max !== null) {
      query.marketCap.$lte = filters.marketCap.max;
    }
    if (Object.keys(query.marketCap).length === 0) {
      delete query.marketCap;
    }
  }
  
  // Process volume filter
  if (filters.avgDollarVolume && filters.avgDollarVolume.min) {
    query.avgDollarVolume = { $gte: filters.avgDollarVolume.min };
  }
  
  // Process debt filter
  if (filters.netDebtToEBITDA && filters.netDebtToEBITDA.max) {
    query.netDebtToEBITDA = { $lte: filters.netDebtToEBITDA.max };
  }
  
  // Process EV/EBIT filter
  if (filters.evToEBIT && filters.evToEBIT.max) {
    query.evToEBIT = { $lte: filters.evToEBIT.max };
  }
  
  // Process ROTCE filter
  if (filters.rotce && filters.rotce.min) {
    query.rotce = { $gte: filters.rotce.min };
  }
  
  // Process score filter
  if (filters.score && filters.score.min) {
    query.score = { $gte: filters.score.min };
  }
  
  // Process exchange filter with normalization
  if (filters.exchange) {
    const normalizedExchange = normalizeExchangeCode(filters.exchange);
    query.exchange = normalizedExchange;
  }
  
  // Process sector filter
  if (filters.sector) {
    query.sector = filters.sector;
  }
  
  // Process industry filter
  if (filters.industry) {
    query.industry = filters.industry;
  }
  
  return query;
};

module.exports = {
  createOrUpdateStock,
  bulkCreateOrUpdateStocks,
  getStocks,
  getStockBySymbol,
  getStockStats,
  deleteStock,
  buildQuery,
  normalizeExchangeCode
};
