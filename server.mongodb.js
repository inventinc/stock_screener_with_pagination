/**
 * Updated server.js to use MongoDB as the backend database
 * Replaces file-based JSON storage with MongoDB
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db/mongoose');
const stocksDAO = require('./db/stocksDAO');
const { migrateDataToMongoDB } = require('./migrateToMongoDB');
const { calculateScore } = require('./scoreCalculator');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB when server starts
let dbInitialized = false;

// Initialize database and migrate data if needed
async function initializeDatabase() {
  if (dbInitialized) return;
  
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Check if we need to migrate data
    const stats = await stocksDAO.getStockStats();
    
    if (stats.total === 0) {
      console.log('No stocks found in MongoDB. Migrating data from JSON...');
      await migrateDataToMongoDB();
    } else {
      console.log(`Database already contains ${stats.total} stocks. Skipping migration.`);
    }
    
    dbInitialized = true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// API Routes

// Get all stocks with filtering
app.get('/api/stocks', async (req, res) => {
  try {
    await initializeDatabase();
    
    // Parse filter parameters
    const filters = {};
    
    // Market Cap filter
    if (req.query.marketCapMin || req.query.marketCapMax) {
      filters.marketCap = {};
      if (req.query.marketCapMin) filters.marketCap.min = parseFloat(req.query.marketCapMin);
      if (req.query.marketCapMax) filters.marketCap.max = parseFloat(req.query.marketCapMax);
    }
    
    // Volume filter
    if (req.query.volumeMin) {
      filters.avgDollarVolume = { min: parseFloat(req.query.volumeMin) };
    }
    
    // Debt filter
    if (req.query.debtMax) {
      filters.netDebtToEBITDA = { max: parseFloat(req.query.debtMax) };
    }
    
    // EV/EBIT filter
    if (req.query.evEbitMax) {
      filters.evToEBIT = { max: parseFloat(req.query.evEbitMax) };
    }
    
    // ROTCE filter
    if (req.query.rotceMin) {
      filters.rotce = { min: parseFloat(req.query.rotceMin) };
    }
    
    // Score filter
    if (req.query.scoreMin) {
      filters.score = { min: parseFloat(req.query.scoreMin) };
    }
    
    // Exchange filter
    if (req.query.exchange) {
      filters.exchange = req.query.exchange;
    }
    
    // Get stocks with filters
    const stocks = await stocksDAO.getStocks(filters);
    
    // Get database stats
    const stats = await stocksDAO.getStockStats();
    
    res.json({
      stocks,
      stats
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// Get stock by symbol
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    await initializeDatabase();
    
    const symbol = req.params.symbol.toUpperCase();
    const stock = await stocksDAO.getStockBySymbol(symbol);
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error(`Error fetching stock ${req.params.symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Get database stats
app.get('/api/stats', async (req, res) => {
  try {
    await initializeDatabase();
    
    const stats = await stocksDAO.getStockStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, 'client', 'build');
  app.use(express.static(clientBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, async () => {
  try {
    console.log(`Server running on port ${PORT}`);
    
    // Initialize database on startup
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to start server properly:', error);
  }
});

// Export for testing
module.exports = app;
