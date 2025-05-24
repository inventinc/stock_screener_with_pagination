/**
 * Fixed Stock Routes - Ensures proper data retrieval from MongoDB
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

// Get all stocks with pagination and filtering
router.get('/stocks', async (req, res) => {
  try {
    console.log('API Request received with query params:', req.query);
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default to 50 stocks per page
    const skip = (page - 1) * limit;
    
    // Build filter query based on request parameters
    // Start with an empty filter to ensure we get results if no filters are specified
    const filter = {};
    
    // Market cap filters - only apply if values are valid numbers
    if (req.query.marketCapMin && !isNaN(parseFloat(req.query.marketCapMin))) {
      filter.marketCap = { $gte: parseFloat(req.query.marketCapMin) };
    }
    if (req.query.marketCapMax && !isNaN(parseFloat(req.query.marketCapMax))) {
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
    
    // Debt level filters - only apply if values are valid numbers
    if (req.query.debtMin !== undefined && !isNaN(parseFloat(req.query.debtMin))) {
      filter.netDebtToEBITDA = { $gte: parseFloat(req.query.debtMin) };
    }
    if (req.query.debtMax !== undefined && !isNaN(parseFloat(req.query.debtMax))) {
      filter.netDebtToEBITDA = { ...filter.netDebtToEBITDA, $lte: parseFloat(req.query.debtMax) };
    }
    
    // Valuation filters (P/E ratio) - only apply if values are valid numbers
    if (req.query.peMin !== undefined && !isNaN(parseFloat(req.query.peMin))) {
      filter.peRatio = { $gte: parseFloat(req.query.peMin) };
    }
    if (req.query.peMax !== undefined && !isNaN(parseFloat(req.query.peMax))) {
      filter.peRatio = { ...filter.peRatio, $lte: parseFloat(req.query.peMax) };
    }
    
    // Score filters - only apply if values are valid numbers
    if (req.query.scoreMin !== undefined && !isNaN(parseFloat(req.query.scoreMin))) {
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
          // Use $exists to ensure we only filter stocks that have these fields
          filter.peRatio = { $exists: true, $gt: 0, $lt: 15 };
          filter.netDebtToEBITDA = { $exists: true, $lt: 3 };
          break;
        case 'growth':
          filter.score = { $exists: true, $gte: 70 };
          break;
        case 'dividend':
          filter.dividendYield = { $exists: true, $gt: 0.02 }; // > 2%
          break;
        case 'quality':
          filter.rotce = { $exists: true, $gt: 0.15 }; // > 15%
          filter.netDebtToEBITDA = { $exists: true, $lt: 2 };
          break;
      }
    }
    
    console.log('Using filter:', JSON.stringify(filter, null, 2));
    
    // Execute query with pagination
    const stocks = await Stock.find(filter)
      .sort({ marketCap: -1 }) // Sort by market cap descending
      .skip(skip)
      .limit(limit);
    
    console.log(`Found ${stocks.length} stocks matching filter`);
    
    // Get total count for pagination
    const total = await Stock.countDocuments(filter);
    
    // Get exchange counts for stats
    const nyseCount = await Stock.countDocuments({ 
      exchange: { $in: [/nyse/i, /xnys/i] }
    });
    
    const nasdaqCount = await Stock.countDocuments({ 
      exchange: { $in: [/nasdaq/i, /xnas/i] }
    });
    
    // Return data with pagination info
    res.json({
      stocks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      stats: {
        total,
        nyse: nyseCount,
        nasdaq: nasdaqCount,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// Get stock by symbol
router.get('/stocks/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const stock = await Stock.findOne({ symbol });
    
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
    const total = await Stock.countDocuments();
    
    // Get exchange counts
    const nyseCount = await Stock.countDocuments({ 
      exchange: { $in: [/nyse/i, /xnys/i] }
    });
    
    const nasdaqCount = await Stock.countDocuments({ 
      exchange: { $in: [/nasdaq/i, /xnas/i] }
    });
    
    // Get data completeness stats
    const missingPriceCount = await Stock.countDocuments({ price: { $eq: 0 } });
    const missingMarketCapCount = await Stock.countDocuments({ marketCap: { $eq: 0 } });
    
    // Get most recent update time
    const latestStock = await Stock.findOne().sort({ lastUpdated: -1 });
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
      lastUpdated
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
