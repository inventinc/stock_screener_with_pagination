/**
 * Modified server.js for Financial Modeling Prep API
 * 
 * This server file has been updated to use FMP API instead of Polygon
 */

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import FMP service
const fmpApiService = require('./fmpApiService');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB';
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Stock model schema
const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: String,
  exchange: String,
  sector: String,
  industry: String,
  price: Number,
  marketCap: Number,
  avgDollarVolume: Number,
  netDebtToEBITDA: Number,
  evToEBIT: Number,
  rotce: Number,
  fcfToNetIncome: Number,
  shareCountGrowth: Number,
  priceToBook: Number,
  insiderOwnership: Number,
  revenueGrowth: Number,
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

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
// Get paginated stocks
app.get('/api/stocks', async (req, res) => {
  try {
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
      stocks
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// Get sectors for filter dropdown
app.get('/api/sectors', async (req, res) => {
  try {
    const sectors = await Stock.distinct('sector');
    res.json(sectors.filter(Boolean).sort());
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// Get a single stock by symbol
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Refresh a single stock
app.post('/api/refresh/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Check if stock exists
    const stock = await Stock.findOne({ symbol });
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    // Get updated data from FMP
    const stockData = await fmpApiService.getStockData(symbol);
    
    if (!stockData) {
      return res.status(404).json({ error: 'Failed to fetch updated data' });
    }
    
    // Update stock in database
    const updatedStock = await Stock.findOneAndUpdate(
      { symbol },
      stockData,
      { new: true }
    );
    
    res.json({ success: true, stock: updatedStock });
  } catch (error) {
    console.error('Error refreshing stock:', error);
    res.status(500).json({ error: 'Failed to refresh stock' });
  }
});

// Refresh a batch of stocks
app.post('/api/refresh/all', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    
    // Get oldest updated stocks
    const stocks = await Stock.find({})
      .sort({ lastUpdated: 1 })
      .limit(limit);
    
    // Start refresh process in background
    refreshStocksInBackground(stocks);
    
    res.json({ success: true, stocks: stocks.map(s => s.symbol) });
  } catch (error) {
    console.error('Error starting batch refresh:', error);
    res.status(500).json({ error: 'Failed to start batch refresh' });
  }
});

// Toggle auto-refresh
app.post('/api/refresh/toggle', (req, res) => {
  // This would normally start/stop a scheduled job
  // For simplicity, we'll just return a success response
  res.json({ success: true, status: 'started' });
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to refresh stocks in background
async function refreshStocksInBackground(stocks) {
  for (const stock of stocks) {
    try {
      // Get updated data from FMP
      const stockData = await fmpApiService.getStockData(stock.symbol);
      
      if (!stockData) {
        console.log(`No data found for ${stock.symbol}, skipping`);
        continue;
      }
      
      // Update stock in database
      await Stock.findOneAndUpdate(
        { symbol: stock.symbol },
        stockData,
        { new: true }
      );
      
      console.log(`Refreshed ${stock.symbol}`);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error refreshing ${stock.symbol}:`, error);
    }
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
