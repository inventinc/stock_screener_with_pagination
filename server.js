/**
 * Fixed Server.js with ROTCE Filter Support
 * 
 * This version fixes the issues with:
 * 1. Missing stats endpoint
 * 2. Filter functionality
 * 3. ROTCE filter support
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Import database connection
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
connectDB()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
// Get stats - FIXED to ensure proper counting
app.get('/api/stats', async (req, res) => {
  try {
    console.log('Stats endpoint called');
    const total = await Stock.countDocuments();
    const nyse = await Stock.countDocuments({ exchange: 'NYSE' });
    const nasdaq = await Stock.countDocuments({ exchange: 'NASDAQ' });
    
    // Get the most recently updated stock
    const latestStock = await Stock.findOne().sort({ lastUpdated: -1 });
    
    const stats = {
      totalStocks: total,
      nyseStocks: nyse,
      nasdaqStocks: nasdaq,
      lastUpdated: latestStock ? latestStock.lastUpdated : null
    };
    
    console.log('Returning stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get stocks with filtering and pagination (FIXED WITH ROTCE FILTER SUPPORT)
app.get('/api/stocks', async (req, res) => {
  try {
    console.log('Stocks endpoint called with query:', req.query);
    
    // Extract existing filter parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || '';
    
    // Build filter query
    const filter = {};
    
    // Add search filter if provided
    if (search) {
      filter.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add market cap filters if provided
    if (req.query.minMarketCap) {
      filter.marketCap = filter.marketCap || {};
      filter.marketCap.$gte = parseFloat(req.query.minMarketCap);
    }
    
    if (req.query.maxMarketCap) {
      filter.marketCap = filter.marketCap || {};
      filter.marketCap.$lte = parseFloat(req.query.maxMarketCap);
    }
    
    // Add volume filters if provided
    if (req.query.minVolume) {
      filter.avgDollarVolume = filter.avgDollarVolume || {};
      filter.avgDollarVolume.$gte = parseFloat(req.query.minVolume);
    }
    
    if (req.query.maxVolume) {
      filter.avgDollarVolume = filter.avgDollarVolume || {};
      filter.avgDollarVolume.$lte = parseFloat(req.query.maxVolume);
    }
    
    // Add debt to EBITDA filters if provided
    if (req.query.minDebtToEBITDA) {
      filter.netDebtToEBITDA = filter.netDebtToEBITDA || {};
      filter.netDebtToEBITDA.$gte = parseFloat(req.query.minDebtToEBITDA);
    }
    
    if (req.query.maxDebtToEBITDA) {
      filter.netDebtToEBITDA = filter.netDebtToEBITDA || {};
      filter.netDebtToEBITDA.$lte = parseFloat(req.query.maxDebtToEBITDA);
    }
    
    // Add P/E ratio filters if provided
    if (req.query.minPE) {
      filter.peRatio = filter.peRatio || {};
      filter.peRatio.$gte = parseFloat(req.query.minPE);
    }
    
    if (req.query.maxPE) {
      filter.peRatio = filter.peRatio || {};
      filter.peRatio.$lte = parseFloat(req.query.maxPE);
    }
    
    // Add ROTCE filters if provided
    if (req.query.minROTCE) {
      filter.rotce = filter.rotce || {};
      filter.rotce.$gte = parseFloat(req.query.minROTCE);
    }
    
    if (req.query.maxROTCE) {
      filter.rotce = filter.rotce || {};
      filter.rotce.$lte = parseFloat(req.query.maxROTCE);
    }
    
    console.log('Applying filter:', JSON.stringify(filter));
    
    // Calculate skip and limit for pagination
    const skip = (page - 1) * pageSize;
    const limit = pageSize;
    
    // Query database
    const stocks = await Stock.find(filter)
      .sort({ marketCap: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Count total matching stocks for pagination
    const total = await Stock.countDocuments(filter);
    
    console.log(`Found ${stocks.length} stocks out of ${total} total matches`);
    
    // Return response
    res.json({
      stocks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// Import stock routes (if they exist)
try {
  const stockRoutes = require('./routes/stockRoutes');
  app.use('/api', stockRoutes);
} catch (error) {
  console.log('Stock routes not found, skipping import');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Refresh a single stock
app.post('/api/refresh/stock', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Fetch stock details from Polygon.io
    const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
    
    // Fetch current price
    const priceResponse = await axios.get(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${POLYGON_API_KEY}`
    );
    
    // Fetch financials
    const financialsResponse = await axios.get(
      `https://api.polygon.io/vX/reference/financials?ticker=${symbol}&apiKey=${POLYGON_API_KEY}`
    );
    
    // Extract price data
    let price = 0;
    let marketCap = 0;
    
    if (priceResponse.data.results && priceResponse.data.results.length > 0) {
      price = priceResponse.data.results[0].c; // Closing price
    }
    
    // Extract financial data
    let netDebtToEBITDA = 0;
    let evToEBIT = 0;
    let rotce = 0;
    
    if (financialsResponse.data.results && financialsResponse.data.results.length > 0) {
      const financials = financialsResponse.data.results[0];
      
      // Calculate market cap
      if (financials.shares_outstanding && price) {
        marketCap = financials.shares_outstanding * price;
      }
      
      // Extract other metrics if available
      if (financials.financials) {
        const fin = financials.financials;
        
        // Net Debt to EBITDA
        if (fin.debt && fin.ebitda) {
          netDebtToEBITDA = fin.debt / fin.ebitda;
        }
        
        // EV to EBIT
        if (fin.enterprise_value && fin.ebit) {
          evToEBIT = fin.enterprise_value / fin.ebit;
        }
        
        // Return on Tangible Capital Employed
        if (fin.net_income && fin.tangible_assets) {
          rotce = fin.net_income / fin.tangible_assets;
        }
      }
    }
    
    // Calculate score
    const score = calculateScore({
      marketCap,
      netDebtToEBITDA,
      evToEBIT,
      rotce
    });
    
    // Update or create stock in database
    const stock = await Stock.findOneAndUpdate(
      { symbol },
      {
        price,
        marketCap,
        netDebtToEBITDA,
        evToEBIT,
        rotce,
        score,
        lastUpdated: new Date()
      },
      { new: true }
    );
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json({ success: true, stock });
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

// Helper function to calculate score
function calculateScore(details) {
  let score = 0;
  
  // Market cap score (0-20)
  if (details.marketCap > 10000000000) score += 20; // $10B+
  else if (details.marketCap > 2000000000) score += 15; // $2B+
  else if (details.marketCap > 300000000) score += 10; // $300M+
  else score += 5;
  
  // Debt score (0-20)
  if (details.netDebtToEBITDA < 1) score += 20;
  else if (details.netDebtToEBITDA < 2) score += 15;
  else if (details.netDebtToEBITDA < 3) score += 10;
  else score += 5;
  
  // Valuation score (0-20)
  if (details.evToEBIT > 0 && details.evToEBIT < 10) score += 20;
  else if (details.evToEBIT > 0 && details.evToEBIT < 15) score += 15;
  else if (details.evToEBIT > 0 && details.evToEBIT < 20) score += 10;
  else score += 5;
  
  // Profitability score (0-20)
  if (details.rotce > 0.2) score += 20;
  else if (details.rotce > 0.15) score += 15;
  else if (details.rotce > 0.1) score += 10;
  else score += 5;
  
  // Add random factor (0-20) for demonstration
  score += Math.floor(Math.random() * 20);
  
  return score;
}

// Helper function to refresh stocks in background
async function refreshStocksInBackground(stocks) {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
  
  for (const stock of stocks) {
    try {
      // Fetch current price
      const priceResponse = await axios.get(
        `https://api.polygon.io/v2/aggs/ticker/${stock.symbol}/prev?apiKey=${POLYGON_API_KEY}`
      );
      
      // Fetch financials
      const financialsResponse = await axios.get(
        `https://api.polygon.io/vX/reference/financials?ticker=${stock.symbol}&apiKey=${POLYGON_API_KEY}`
      );
      
      // Extract price data
      let price = 0;
      let marketCap = 0;
      
      if (priceResponse.data.results && priceResponse.data.results.length > 0) {
        price = priceResponse.data.results[0].c; // Closing price
      }
      
      // Extract financial data
      let netDebtToEBITDA = 0;
      let evToEBIT = 0;
      let rotce = 0;
      
      if (financialsResponse.data.results && financialsResponse.data.results.length > 0) {
        const financials = financialsResponse.data.results[0];
        
        // Calculate market cap
        if (financials.shares_outstanding && price) {
          marketCap = financials.shares_outstanding * price;
        }
        
        // Extract other metrics if available
        if (financials.financials) {
          const fin = financials.financials;
          
          // Net Debt to EBITDA
          if (fin.debt && fin.ebitda) {
            netDebtToEBITDA = fin.debt / fin.ebitda;
          }
          
          // EV to EBIT
          if (fin.enterprise_value && fin.ebit) {
            evToEBIT = fin.enterprise_value / fin.ebit;
          }
          
          // Return on Tangible Capital Employed
          if (fin.net_income && fin.tangible_assets) {
            rotce = fin.net_income / fin.tangible_assets;
          }
        }
      }
      
      // Calculate score
      const score = calculateScore({
        marketCap,
        netDebtToEBITDA,
        evToEBIT,
        rotce
      });
      
      // Update stock in database
      await Stock.findByIdAndUpdate(
        stock._id,
        {
          price,
          marketCap,
          netDebtToEBITDA,
          evToEBIT,
          rotce,
          score,
          lastUpdated: new Date()
        }
      );
      
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
