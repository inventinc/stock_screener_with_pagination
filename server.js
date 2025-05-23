/**
 * Enhanced server.js for stock screener with improved MongoDB connection handling
 * This version includes better error handling and connection status endpoint
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Track database connection status
let dbConnected = false;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB when server starts
async function initializeDatabase() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    dbConnected = true;
    
    // Set up connection event handlers for monitoring
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
      dbConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
      dbConnected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      dbConnected = true;
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    dbConnected = false;
    return false;
  }
}

// Define stock schema
const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: String,
  exchange: String,
  sector: String,
  industry: String,
  price: Number,
  marketCap: Number,
  peRatio: Number,
  dividendYield: Number,
  netDebtToEBITDA: Number,
  evToEBIT: Number,
  rotce: Number,
  avgDollarVolume: Number,
  score: Number,
  lastUpdated: { type: Date, default: Date.now }
});

// Create or get the Stock model
let Stock;
try {
  Stock = mongoose.model('Stock');
} catch (e) {
  Stock = mongoose.model('Stock', stockSchema);
}

// API Routes

// Status endpoint for checking database connection
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Get paginated stocks
app.get('/api/stocks', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        status: 'disconnected'
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Get filters from query params
    const filters = {};
    
    if (req.query.sector) {
      filters.sector = req.query.sector;
    }
    
    if (req.query.minMarketCap) {
      filters.marketCap = { $gte: parseFloat(req.query.minMarketCap) };
    }
    
    if (req.query.maxDebt) {
      filters.netDebtToEBITDA = { $lte: parseFloat(req.query.maxDebt) };
    }
    
    // Get total count for pagination
    const total = await Stock.countDocuments(filters);
    
    // Get stocks
    const stocks = await Stock.find(filters)
      .sort({ score: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      stocks,
      status: 'connected'
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stocks',
      details: error.message
    });
  }
});

// Get sectors for filter dropdown
app.get('/api/sectors', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        status: 'disconnected'
      });
    }
    
    const sectors = await Stock.distinct('sector');
    res.json(sectors.filter(Boolean).sort());
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sectors',
      details: error.message
    });
  }
});

// Get a single stock by symbol
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        status: 'disconnected'
      });
    }
    
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stock',
      details: error.message
    });
  }
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
async function startServer() {
  // Try to connect to the database
  const dbInitialized = await initializeDatabase();
  
  // Start the server even if database connection fails
  // This allows the frontend to show connection status
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database connection status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
    
    if (!dbInitialized) {
      console.log('Server started without database connection. Will retry connection automatically.');
      
      // Set up periodic reconnection attempts
      const reconnectInterval = setInterval(async () => {
        console.log('Attempting to reconnect to database...');
        const reconnected = await initializeDatabase();
        
        if (reconnected) {
          console.log('Successfully reconnected to database');
          clearInterval(reconnectInterval);
        }
      }, 30000); // Try every 30 seconds
    }
  });
}

// Start the server
startServer();
