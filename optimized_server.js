/**
 * Optimized Frontend Data Loading Script
 * 
 * This script modifies the server.js file to implement:
 * 1. Pagination for more efficient data loading
 * 2. Optimized statistics calculation
 * 3. Caching for frequently accessed data
 * 4. CORS enabled for all origins
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const NodeCache = require('node-cache');
require('dotenv').config();

// Import database connection
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
connectDB()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check request received');
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get paginated stocks with efficient filtering
app.get('/api/stocks', async (req, res) => {
  console.log(`API request received: ${req.url}`);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Build filter based on query parameters
    const filter = {};
    
    // Exchange filter
    if (req.query.exchange) {
      filter.exchange = req.query.exchange;
    }
    
    // Market cap filter
    if (req.query.minMarketCap) {
      filter.marketCap = { $gte: parseFloat(req.query.minMarketCap) };
    }
    if (req.query.maxMarketCap) {
      filter.marketCap = { ...filter.marketCap, $lte: parseFloat(req.query.maxMarketCap) };
    }
    
    // P/E Ratio filter
    if (req.query.minPE) {
      filter.peRatio = { $gte: parseFloat(req.query.minPE) };
    }
    if (req.query.maxPE) {
      filter.peRatio = { ...filter.peRatio, $lte: parseFloat(req.query.maxPE) };
    }
    
    // Dividend Yield filter
    if (req.query.minDividend) {
      filter.dividendYield = { $gte: parseFloat(req.query.minDividend) };
    }
    if (req.query.maxDividend) {
      filter.dividendYield = { ...filter.dividendYield, $lte: parseFloat(req.query.maxDividend) };
    }
    
    // Has P/E Ratio filter
    if (req.query.hasPE === 'true') {
      filter.peRatio = { $ne: null, $exists: true };
    }
    
    // Has Dividend Yield filter
    if (req.query.hasDividend === 'true') {
      filter.dividendYield = { $ne: null, $exists: true };
    }
    
    // Generate cache key based on query parameters
    const cacheKey = `stocks_${JSON.stringify(filter)}_${page}_${limit}`;
    
    // Check if data is in cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached data for ${cacheKey}`);
      return res.json(cachedData);
    }
    
    // Execute query with pagination
    const stocks = await Stock.find(filter)
      .sort({ marketCap: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await Stock.countDocuments(filter);
    
    const result = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      stocks
    };
    
    // Store in cache
    cache.set(cacheKey, result);
    
    console.log(`Returning ${stocks.length} stocks (page ${page}/${Math.ceil(total / limit)})`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// Get statistics with caching
app.get('/api/stats', async (req, res) => {
  console.log('Stats request received');
  try {
    // Check if stats are in cache
    const cachedStats = cache.get('stock_stats');
    if (cachedStats) {
      console.log('Returning cached stats');
      return res.json(cachedStats);
    }
    
    // Calculate statistics
    const totalStocks = await Stock.countDocuments();
    
    const nyseCount = await Stock.countDocuments({ exchange: 'NYSE' });
    const nasdaqCount = await Stock.countDocuments({ exchange: 'NASDAQ' });
    
    const withPE = await Stock.countDocuments({ 
      peRatio: { $ne: null, $exists: true } 
    });
    
    const withDividend = await Stock.countDocuments({ 
      dividendYield: { $ne: null, $exists: true } 
    });
    
    const withBoth = await Stock.countDocuments({ 
      peRatio: { $ne: null, $exists: true },
      dividendYield: { $ne: null, $exists: true } 
    });
    
    // Market cap distribution
    const marketCapCategories = [
      { name: 'Large Cap', min: 10000000000, max: Infinity },
      { name: 'Mid Cap', min: 2000000000, max: 10000000000 },
      { name: 'Small Cap', min: 300000000, max: 2000000000 },
      { name: 'Micro Cap', min: 0, max: 300000000 }
    ];
    
    const marketCapDistribution = {};
    
    for (const category of marketCapCategories) {
      const count = await Stock.countDocuments({ 
        marketCap: { $gte: category.min, $lt: category.max } 
      });
      
      marketCapDistribution[category.name] = count;
    }
    
    const stats = {
      totalStocks,
      byExchange: {
        NYSE: nyseCount,
        NASDAQ: nasdaqCount
      },
      metrics: {
        withPE,
        withPERatio: (withPE / totalStocks * 100).toFixed(2),
        withDividend,
        withDividendYield: (withDividend / totalStocks * 100).toFixed(2),
        withBoth,
        withBothMetrics: (withBoth / totalStocks * 100).toFixed(2)
      },
      marketCapDistribution
    };
    
    // Store in cache for 5 minutes
    cache.set('stock_stats', stats);
    
    console.log('Returning calculated stats');
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get top stocks by market cap
app.get('/api/top-stocks', async (req, res) => {
  console.log('Top stocks request received');
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if data is in cache
    const cacheKey = `top_stocks_${limit}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached top ${limit} stocks`);
      return res.json(cachedData);
    }
    
    const stocks = await Stock.find({})
      .sort({ marketCap: -1 })
      .limit(limit)
      .lean();
    
    // Store in cache
    cache.set(cacheKey, stocks);
    
    console.log(`Returning top ${stocks.length} stocks`);
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching top stocks:', error);
    res.status(500).json({ error: 'Failed to fetch top stocks' });
  }
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server started at ${new Date().toISOString()}`);
  console.log(`CORS enabled for all origins`);
});
