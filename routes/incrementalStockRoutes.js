/**
 * Enhanced API endpoints for stock data with optimized incremental loading
 * Supports smaller batch sizes (50-75) for better user experience
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

// Get total count of stocks with optional ETF exclusion
router.get('/stocks/count', async (req, res) => {
  try {
    const filter = {};
    
    // Exclude ETFs if requested
    if (req.query.excludeETFs === 'true') {
      filter.type = { $ne: 'ETF' };
    }
    
    const count = await Stock.countDocuments(filter);
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching stock count:', error);
    res.status(500).json({ error: 'Failed to fetch stock count' });
  }
});

// Get stocks with pagination, filtering, and ETF exclusion
// Optimized for smaller batch sizes (50-75)
router.get('/stocks', async (req, res) => {
  try {
    // Use smaller default limit for better performance
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Build filter query based on request parameters
    const filter = {};
    
    // Exclude ETFs if requested
    if (req.query.excludeETFs === 'true') {
      filter.type = { $ne: 'ETF' };
    }
    
    // Market cap filters
    if (req.query.marketCapMin) {
      filter.marketCap = { $gte: parseFloat(req.query.marketCapMin) };
    }
    if (req.query.marketCapMax) {
      filter.marketCap = { ...filter.marketCap, $lte: parseFloat(req.query.marketCapMax) };
    }
    
    // Exchange filters
    if (req.query.exchange) {
      // Handle multiple exchanges and case-insensitive matching
      const exchanges = req.query.exchange.split(',').map(e => 
        new RegExp(e.trim(), 'i')
      );
      filter.exchange = { $in: exchanges };
    }
    
    // Debt level filters
    if (req.query.debtMin !== undefined) {
      filter.netDebtToEBITDA = { $gte: parseFloat(req.query.debtMin) };
    }
    if (req.query.debtMax !== undefined) {
      filter.netDebtToEBITDA = { ...filter.netDebtToEBITDA, $lte: parseFloat(req.query.debtMax) };
    }
    
    // Valuation filters (P/E ratio)
    if (req.query.peMin !== undefined) {
      filter.peRatio = { $gte: parseFloat(req.query.peMin) };
    }
    if (req.query.peMax !== undefined) {
      filter.peRatio = { ...filter.peRatio, $lte: parseFloat(req.query.peMax) };
    }
    
    // Score filters
    if (req.query.scoreMin !== undefined) {
      filter.score = { $gte: parseFloat(req.query.scoreMin) };
    }
    
    // Search by symbol or name
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { symbol: searchRegex },
        { name: searchRegex }
      ];
    }
    
    // Preset filters
    if (req.query.preset) {
      switch(req.query.preset) {
        case 'value':
          filter.peRatio = { $gt: 0, $lt: 15 };
          filter.netDebtToEBITDA = { $lt: 3 };
          break;
        case 'growth':
          filter.score = { $gte: 70 };
          break;
        case 'dividend':
          filter.dividendYield = { $gt: 0.02 }; // > 2%
          break;
        case 'quality':
          filter.rotce = { $gt: 0.15 }; // > 15%
          filter.netDebtToEBITDA = { $lt: 2 };
          break;
      }
    }
    
    // Create projection to include only necessary fields for better performance
    const projection = {
      symbol: 1,
      ticker: 1,
      name: 1,
      exchange: 1,
      primary_exchange: 1,
      price: 1,
      marketCap: 1,
      market_cap: 1,
      peRatio: 1,
      pe_ratio: 1,
      dividendYield: 1,
      dividend_yield: 1,
      yearHigh: 1,
      year_high: 1,
      score: 1,
      custom_score: 1,
      netDebtToEBITDA: 1,
      debt_to_ebitda: 1,
      volume: 1,
      type: 1,
      last_trade: 1,
      rotce: 1,
      returnOnTangibleCapital: 1
    };
    
    // Execute query with pagination and projection
    const stocks = await Stock.find(filter, projection)
      .sort({ marketCap: -1 }) // Sort by market cap descending
      .skip(offset)
      .limit(limit)
      .lean(); // Use lean for better performance
    
    // Get total count for pagination
    const total = await Stock.countDocuments(filter);
    
    // Get exchange counts for stats (only if requested)
    let stats = {};
    if (req.query.includeStats === 'true') {
      const nyseCount = await Stock.countDocuments({ 
        ...filter,
        $or: [
          { exchange: { $in: [/nyse/i, /xnys/i] } },
          { primary_exchange: { $in: [/nyse/i, /xnys/i] } }
        ]
      });
      
      const nasdaqCount = await Stock.countDocuments({ 
        ...filter,
        $or: [
          { exchange: { $in: [/nasdaq/i, /xnas/i] } },
          { primary_exchange: { $in: [/nasdaq/i, /xnas/i] } }
        ]
      });
      
      stats = {
        total,
        nyse: nyseCount,
        nasdaq: nasdaqCount,
        lastUpdated: new Date()
      };
    }
    
    // Return data with pagination info
    res.json({
      stocks,
      pagination: {
        total,
        offset,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: offset + stocks.length < total
      },
      stats: req.query.includeStats === 'true' ? stats : undefined
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks', details: error.message });
  }
});

// Get stock by symbol
router.get('/stocks/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Try to find by symbol or ticker
    const stock = await Stock.findOne({
      $or: [
        { symbol: symbol },
        { ticker: symbol }
      ]
    }).lean();
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error(`Error fetching stock ${req.params.symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Get stats about the database
router.get('/stats', async (req, res) => {
  try {
    // Base filter to exclude ETFs if requested
    const baseFilter = req.query.excludeETFs === 'true' ? { type: { $ne: 'ETF' } } : {};
    
    // Get total count
    const total = await Stock.countDocuments(baseFilter);
    
    // Get exchange counts
    const nyseCount = await Stock.countDocuments({ 
      ...baseFilter,
      $or: [
        { exchange: { $in: [/nyse/i, /xnys/i] } },
        { primary_exchange: { $in: [/nyse/i, /xnys/i] } }
      ]
    });
    
    const nasdaqCount = await Stock.countDocuments({ 
      ...baseFilter,
      $or: [
        { exchange: { $in: [/nasdaq/i, /xnas/i] } },
        { primary_exchange: { $in: [/nasdaq/i, /xnas/i] } }
      ]
    });
    
    // Get data completeness stats
    const missingPriceCount = await Stock.countDocuments({ 
      ...baseFilter,
      $or: [
        { price: { $eq: 0 } },
        { price: { $exists: false } }
      ]
    });
    
    const missingMarketCapCount = await Stock.countDocuments({ 
      ...baseFilter,
      $or: [
        { marketCap: { $eq: 0 } },
        { marketCap: { $exists: false } },
        { market_cap: { $eq: 0 } },
        { market_cap: { $exists: false } }
      ]
    });
    
    // Get most recent update time
    const latestStock = await Stock.findOne(baseFilter).sort({ lastUpdated: -1 });
    const lastUpdated = latestStock ? latestStock.lastUpdated : null;
    
    res.json({
      total,
      nyse: nyseCount,
      nasdaq: nasdaqCount,
      dataCompleteness: {
        missingPrice: missingPriceCount,
        missingMarketCap: missingMarketCapCount,
        completenessPercentage: ((total - Math.max(missingPriceCount, missingMarketCapCount)) / total * 100).toFixed(2)
      },
      lastUpdated,
      etfsExcluded: req.query.excludeETFs === 'true'
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
