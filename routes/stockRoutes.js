/**
 * Enhanced API endpoint for frontend to get stock data with pagination and filtering
 * Includes performance optimizations for faster response times
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

// Cache for stats to avoid repeated queries
let statsCache = null;
let statsCacheTime = null;
const STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for filtered results
const queryCache = new Map();
const QUERY_CACHE_SIZE = 50; // Maximum number of cached queries
const QUERY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

/**
 * Get all stocks with pagination and filtering - OPTIMIZED VERSION
 * Implements caching, parallel queries, and lean execution
 */
router.get('/stocks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.pageSize || req.query.limit) || 100;
    const skip = (page - 1) * limit;
    
    // Generate cache key from query parameters
    const cacheKey = generateCacheKey(req.query, page, limit);
    
    // Check cache for existing results
    const cachedResult = checkQueryCache(cacheKey);
    if (cachedResult) {
      console.log('Cache hit for query:', cacheKey);
      return res.json(cachedResult);
    }
    
    console.log('Cache miss, executing query:', cacheKey);
    
    // Build filter query based on request parameters
    const filter = buildFilterQuery(req.query);
    
    // Execute main query and count in parallel for better performance
    const [stocks, total] = await Promise.all([
      Stock.find(filter)
        .sort({ marketCap: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for faster query execution
      Stock.countDocuments(filter)
    ]);
    
    // Get stats (from cache if possible)
    const stats = await getStatsWithCache();
    
    // Prepare response
    const result = {
      stocks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      stats
    };
    
    // Cache the result
    cacheQueryResult(cacheKey, result);
    
    // Return data
    res.json(result);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

/**
 * Get stock by symbol - OPTIMIZED VERSION
 * Uses lean execution and proper error handling
 */
router.get('/stocks/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Use the static method from the model and lean execution
    const stock = await Stock.findBySymbol(symbol).lean();
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error(`Error fetching stock ${req.params.symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

/**
 * Get stats about the database - OPTIMIZED VERSION
 * Implements caching to avoid repeated queries
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStatsWithCache();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * Helper function to build filter query
 * @param {Object} queryParams - Request query parameters
 * @returns {Object} MongoDB filter object
 */
function buildFilterQuery(queryParams) {
  const filter = {};
  
  // Market cap filters
  if (queryParams.marketCapMin) {
    filter.marketCap = { $gte: parseFloat(queryParams.marketCapMin) };
  }
  if (queryParams.marketCapMax) {
    filter.marketCap = { ...filter.marketCap, $lte: parseFloat(queryParams.marketCapMax) };
  }
  
  // Exchange filters
  if (queryParams.exchange) {
    // Handle multiple exchanges and case-insensitive matching
    const exchanges = queryParams.exchange.split(',').map(e => 
      new RegExp(e.trim(), 'i')
    );
    filter.exchange = { $in: exchanges };
  }
  
  // Volume filters
  if (queryParams.avgVolumeMin !== undefined) {
    filter.avgDollarVolume = { $gte: parseFloat(queryParams.avgVolumeMin) };
  }
  if (queryParams.avgVolumeMax !== undefined) {
    filter.avgDollarVolume = { ...filter.avgDollarVolume, $lte: parseFloat(queryParams.avgVolumeMax) };
  }
  
  // Debt level filters
  if (queryParams.debtMin !== undefined) {
    filter.netDebtToEBITDA = { $gte: parseFloat(queryParams.debtMin) };
  }
  if (queryParams.debtMax !== undefined) {
    filter.netDebtToEBITDA = { ...filter.netDebtToEBITDA, $lte: parseFloat(queryParams.debtMax) };
  }
  
  // Valuation filters (P/E ratio)
  if (queryParams.peMin !== undefined) {
    filter.peRatio = { $gte: parseFloat(queryParams.peMin) };
  }
  if (queryParams.peMax !== undefined) {
    filter.peRatio = { ...filter.peRatio, $lte: parseFloat(queryParams.peMax) };
  }
  
  // Score filters
  if (queryParams.scoreMin !== undefined) {
    filter.score = { $gte: parseFloat(queryParams.scoreMin) };
  }
  
  // Search by symbol or name
  if (queryParams.search) {
    // Try to use text index if available, otherwise fall back to regex
    try {
      // Check if text index exists
      const textSearch = { $text: { $search: queryParams.search } };
      filter.$or = [
        textSearch,
        // Fallback for exact matches that text search might miss
        { symbol: new RegExp('^' + queryParams.search.toUpperCase() + '$') }
      ];
    } catch (e) {
      // Fallback to regex if text index not available
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { symbol: searchRegex },
        { name: searchRegex }
      ];
    }
  }
  
  // Preset filters
  if (queryParams.preset) {
    const presets = Array.isArray(queryParams.preset) 
      ? queryParams.preset 
      : [queryParams.preset];
    
    // Handle multiple presets with $and
    const presetFilters = presets.map(preset => {
      switch(preset) {
        case 'value':
          return {
            peRatio: { $gt: 0, $lt: 15 },
            netDebtToEBITDA: { $lt: 3 }
          };
        case 'growth':
          return { score: { $gte: 70 } };
        case 'dividend':
          return { dividendYield: { $gt: 0.02 } }; // > 2%
        case 'quality':
          return {
            rotce: { $gt: 0.15 }, // > 15%
            netDebtToEBITDA: { $lt: 2 }
          };
        default:
          return {};
      }
    });
    
    if (presetFilters.length > 0) {
      // Only add $and if there are valid preset filters
      if (!filter.$and) {
        filter.$and = [];
      }
      filter.$and = [...filter.$and, ...presetFilters];
    }
  }
  
  return filter;
}

/**
 * Generate a cache key from query parameters
 * @param {Object} queryParams - Request query parameters
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @returns {String} Cache key
 */
function generateCacheKey(queryParams, page, limit) {
  // Create a sorted representation of query parameters
  const sortedParams = Object.keys(queryParams)
    .sort()
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');
  
  return `page=${page}&limit=${limit}&${sortedParams}`;
}

/**
 * Check if a query result is cached
 * @param {String} cacheKey - Cache key
 * @returns {Object|null} Cached result or null
 */
function checkQueryCache(cacheKey) {
  if (!queryCache.has(cacheKey)) {
    return null;
  }
  
  const { timestamp, data } = queryCache.get(cacheKey);
  const now = Date.now();
  
  // Check if cache is expired
  if (now - timestamp > QUERY_CACHE_DURATION) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return data;
}

/**
 * Cache a query result
 * @param {String} cacheKey - Cache key
 * @param {Object} result - Query result
 */
function cacheQueryResult(cacheKey, result) {
  // Limit cache size
  if (queryCache.size >= QUERY_CACHE_SIZE) {
    // Remove oldest entry
    const oldestKey = Array.from(queryCache.keys())[0];
    queryCache.delete(oldestKey);
  }
  
  queryCache.set(cacheKey, {
    timestamp: Date.now(),
    data: result
  });
}

/**
 * Get stats with caching
 * @returns {Object} Stats object
 */
async function getStatsWithCache() {
  const now = Date.now();
  
  // Return cached stats if available and not expired
  if (statsCache && statsCacheTime && (now - statsCacheTime < STATS_CACHE_DURATION)) {
    return statsCache;
  }
  
  // Otherwise, fetch fresh stats
  console.log('Stats cache miss, fetching fresh stats');
  
  // Execute queries in parallel
  const [total, nyseCount, nasdaqCount, latestStock] = await Promise.all([
    Stock.countDocuments(),
    Stock.countDocuments({ exchange: { $in: [/nyse/i, /xnys/i] } }),
    Stock.countDocuments({ exchange: { $in: [/nasdaq/i, /xnas/i] } }),
    Stock.findOne().sort({ lastUpdated: -1 }).lean()
  ]);
  
  // Get data completeness stats in parallel
  const [missingPriceCount, missingMarketCapCount] = await Promise.all([
    Stock.countDocuments({ price: { $eq: 0 } }),
    Stock.countDocuments({ marketCap: { $eq: 0 } })
  ]);
  
  // Update cache
  statsCache = {
    total,
    nyse: nyseCount,
    nasdaq: nasdaqCount,
    dataCompleteness: {
      missingPrice: missingPriceCount,
      missingMarketCap: missingMarketCapCount,
      completenessPercentage: ((total - Math.max(missingPriceCount, missingMarketCapCount)) / total * 100).toFixed(2)
    },
    lastUpdated: latestStock ? latestStock.lastUpdated : new Date()
  };
  statsCacheTime = now;
  
  return statsCache;
}

module.exports = router;
