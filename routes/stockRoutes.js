/**
 * Enhanced API endpoint for frontend to get stock data with pagination and filtering
 * Includes all necessary data points for complete functionality
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

// Get all stocks with pagination and filtering
router.get('/stocks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.pageSize || req.query.limit) || 100; // Accept both pageSize and limit
    const skip = (page - 1) * limit;
    
    // Build filter query based on request parameters
    const filter = {};
    
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
    
    // Execute query with pagination
    const stocks = await Stock.find(filter)
      .sort({ marketCap: -1 }) // Sort by market cap descending
      .skip(skip)
      .limit(limit);
    
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
      stocks: stocks, // Ensure stocks are in a 'stocks' property as expected by frontend
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
