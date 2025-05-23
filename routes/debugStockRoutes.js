/**
 * Debug API Routes - Simplified with no filters and detailed logging
 */
const express = require('express');
const router = express.Router();
const Stock = require('../db/models/Stock');

// Get all stocks with pagination and NO filtering
router.get('/stocks', async (req, res) => {
  try {
    console.log('DEBUG API Request received with query params:', req.query);
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default to 50 stocks per page
    const skip = (page - 1) * limit;
    
    console.log('DEBUG Pagination:', { page, limit, skip });
    
    // NO FILTERS - just get raw data
    const filter = {};
    console.log('DEBUG Using empty filter to get all stocks');
    
    // Log database connection status
    console.log('DEBUG MongoDB connection state:', 
      Stock.db.readyState === 1 ? 'connected' : 'not connected');
    
    // Log collection name
    console.log('DEBUG Collection name:', Stock.collection.name);
    
    // Execute query with pagination
    console.log('DEBUG Executing find() query...');
    const stocks = await Stock.find(filter)
      .sort({ marketCap: -1 }) // Sort by market cap descending
      .skip(skip)
      .limit(limit);
    
    console.log(`DEBUG Found ${stocks.length} stocks with empty filter`);
    
    // If no stocks found, try a direct count
    if (stocks.length === 0) {
      const rawCount = await Stock.collection.countDocuments();
      console.log(`DEBUG Raw collection count: ${rawCount}`);
      
      // Try a direct find with native driver
      const rawResults = await Stock.collection.find({}).limit(2).toArray();
      console.log('DEBUG Raw results sample:', 
        rawResults.length > 0 ? JSON.stringify(rawResults[0].symbol) : 'No results');
    }
    
    // Get total count for pagination
    const total = await Stock.countDocuments(filter);
    console.log(`DEBUG Total count with filter: ${total}`);
    
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
    console.error('DEBUG Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks', details: error.message });
  }
});

// Get stock by symbol
router.get('/stocks/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    console.log(`DEBUG Looking for stock with symbol: ${symbol}`);
    
    const stock = await Stock.findOne({ symbol });
    
    if (!stock) {
      console.log(`DEBUG Stock not found: ${symbol}`);
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    console.log(`DEBUG Found stock: ${symbol}`);
    res.json(stock);
  } catch (error) {
    console.error(`DEBUG Error fetching stock ${req.params.symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Get stats about the database
router.get('/stats', async (req, res) => {
  try {
    console.log('DEBUG Getting database stats');
    const total = await Stock.countDocuments();
    console.log(`DEBUG Total stocks in database: ${total}`);
    
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
    console.error('DEBUG Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
