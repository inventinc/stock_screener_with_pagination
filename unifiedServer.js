/**
 * Unified server with MongoDB integration, Polygon.io API services,
 * and real-time data refresh scheduler
 */

// Core dependencies
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Database connection
const { connectDB } = require('./db/mongoose');
const { StockModel } = require('./db/models/Stock');

// API services
const polygonApiService = require('./polygonApiService');
const yahooFinanceService = require('./yahooFinanceService');

// Data refresh scheduler
const scheduler = require('node-schedule');

// Configuration
const PORT = process.env.PORT || 3001;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'l2nLlcjoSEzsnnQGNZMSVDyo_spG1PKk';
const MARKET_OPEN_HOUR = 9; // 9:30 AM ET
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16; // 4:00 PM ET
const MARKET_CLOSE_MINUTE = 0;
const STOCKS_PER_BATCH = 50;
const BATCH_DELAY_MS = 2000;

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
connectDB();

/**
 * Check if current time is during market hours (9:30 AM - 4:00 PM ET)
 * @returns {boolean} True if market is open
 */
function isMarketHours() {
  // Convert current time to ET
  const now = new Date();
  const etOptions = { timeZone: 'America/New_York' };
  const etTime = new Date(now.toLocaleString('en-US', etOptions));
  
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  
  // Check if weekend
  const day = etTime.getDay();
  if (day === 0 || day === 6) {
    return false; // Weekend
  }
  
  // Check if within market hours
  if (hours < MARKET_OPEN_HOUR || hours > MARKET_CLOSE_HOUR) {
    return false;
  }
  
  if (hours === MARKET_OPEN_HOUR && minutes < MARKET_OPEN_MINUTE) {
    return false;
  }
  
  if (hours === MARKET_CLOSE_HOUR && minutes >= MARKET_CLOSE_MINUTE) {
    return false;
  }
  
  return true;
}

/**
 * Divide stocks into rotation groups for hourly updates
 * @param {Array} stocks - Array of stock symbols
 * @param {number} groupCount - Number of groups to create
 * @returns {Array} Array of stock symbol groups
 */
function createRotationGroups(stocks, groupCount = 6) {
  const groups = Array.from({ length: groupCount }, () => []);
  
  stocks.forEach((stock, index) => {
    const groupIndex = index % groupCount;
    groups[groupIndex].push(stock);
  });
  
  return groups;
}

/**
 * Process a batch of stocks with delay between API calls
 * @param {Array} stocks - Array of stock symbols to process
 * @param {number} batchSize - Number of stocks per batch
 * @param {number} delayMs - Delay between batches in milliseconds
 */
async function processBatchWithDelay(stocks, batchSize = STOCKS_PER_BATCH, delayMs = BATCH_DELAY_MS) {
  const batches = [];
  
  // Create batches
  for (let i = 0; i < stocks.length; i += batchSize) {
    batches.push(stocks.slice(i, i + batchSize));
  }
  
  // Process each batch with delay
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Process batch
    await Promise.all(batch.map(async (symbol) => {
      try {
        await updateStockData(symbol);
      } catch (error) {
        console.error(`Error updating ${symbol}:`, error.message);
      }
    }));
    
    // Add delay between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Update stock data for a single symbol
 * @param {string} symbol - Stock symbol
 */
async function updateStockData(symbol) {
  try {
    console.log(`Updating data for ${symbol}...`);
    
    // Fetch ticker details
    const tickerDetails = await polygonApiService.fetchPolygonTickerDetails(symbol);
    
    // Fetch latest price data
    const priceData = await polygonApiService.fetchPolygonLatestPrice(symbol);
    
    // Fetch financial data
    const financialsData = await polygonApiService.fetchPolygonFinancials(symbol);
    
    // Extract current price and shares outstanding
    const currentPrice = priceData?.lastTrade?.p || 0;
    const outstandingShares = tickerDetails?.weighted_shares_outstanding || 0;
    
    // Calculate financial ratios
    const ratios = polygonApiService.calculateFinancialRatios(financialsData, currentPrice, outstandingShares);
    
    // Prepare stock data
    const stockData = {
      symbol: symbol,
      name: tickerDetails?.name || '',
      exchange: tickerDetails?.primary_exchange || '',
      sector: tickerDetails?.sic_description || '',
      industry: tickerDetails?.standard_industrial_classification?.industry_title || '',
      price: currentPrice,
      marketCap: currentPrice * outstandingShares,
      avgDollarVolume: currentPrice * (priceData?.day?.v || 0),
      netDebtToEBITDA: ratios?.netDebtToEBITDA || 0,
      evToEBIT: ratios?.evToEBIT || 0,
      rotce: ratios?.rotce || 0,
      lastUpdated: new Date(),
      dataSource: {
        tickerDetails: 'polygon',
        priceData: 'polygon',
        financialRatios: 'polygon-calculated'
      }
    };
    
    // Calculate score
    const score = calculateScore(stockData);
    stockData.score = score;
    
    // Update or create stock in database
    await StockModel.findOneAndUpdate(
      { symbol: symbol },
      stockData,
      { upsert: true, new: true }
    );
    
    console.log(`Updated ${symbol} successfully`);
    return true;
  } catch (error) {
    console.error(`Error updating ${symbol}:`, error.message);
    return false;
  }
}

/**
 * Calculate stock score based on financial metrics
 * @param {Object} stock - Stock data
 * @returns {number} Score value
 */
function calculateScore(stock) {
  try {
    // Extract metrics
    const { netDebtToEBITDA, evToEBIT, rotce } = stock;
    
    // Calculate individual scores
    let debtScore = 0;
    let valuationScore = 0;
    let returnsScore = 0;
    
    // Debt score (lower is better)
    if (netDebtToEBITDA <= 0) {
      debtScore = 33.33; // No debt is best
    } else if (netDebtToEBITDA <= 1) {
      debtScore = 30;
    } else if (netDebtToEBITDA <= 2) {
      debtScore = 25;
    } else if (netDebtToEBITDA <= 3) {
      debtScore = 20;
    } else if (netDebtToEBITDA <= 4) {
      debtScore = 15;
    } else {
      debtScore = 10;
    }
    
    // Valuation score (lower is better)
    if (evToEBIT <= 5) {
      valuationScore = 33.33;
    } else if (evToEBIT <= 10) {
      valuationScore = 30;
    } else if (evToEBIT <= 15) {
      valuationScore = 25;
    } else if (evToEBIT <= 20) {
      valuationScore = 20;
    } else if (evToEBIT <= 25) {
      valuationScore = 15;
    } else {
      valuationScore = 10;
    }
    
    // Returns score (higher is better)
    if (rotce >= 0.4) {
      returnsScore = 33.33;
    } else if (rotce >= 0.3) {
      returnsScore = 30;
    } else if (rotce >= 0.2) {
      returnsScore = 25;
    } else if (rotce >= 0.15) {
      returnsScore = 20;
    } else if (rotce >= 0.1) {
      returnsScore = 15;
    } else {
      returnsScore = 10;
    }
    
    // Calculate total score
    const totalScore = debtScore + valuationScore + returnsScore;
    return totalScore;
  } catch (error) {
    console.error('Error calculating score:', error.message);
    return 0;
  }
}

/**
 * Schedule data refresh for a specific hour
 * @param {number} hour - Hour to schedule (0-23)
 * @param {Array} stocks - Array of stock symbols to update
 */
function scheduleHourlyRefresh(hour, stocks) {
  const cronExpression = `0 0 ${hour} * * 1-5`; // At the top of the hour, weekdays only
  
  scheduler.scheduleJob(cronExpression, async () => {
    if (!isMarketHours()) {
      console.log(`Skipping scheduled update at ${hour}:00 - outside market hours`);
      return;
    }
    
    console.log(`Starting scheduled update for hour ${hour}:00`);
    await processBatchWithDelay(stocks);
    console.log(`Completed scheduled update for hour ${hour}:00`);
  });
}

/**
 * Initialize data refresh scheduler
 */
async function initializeDataRefreshScheduler() {
  try {
    console.log('Initializing data refresh scheduler...');
    
    // Get all stock symbols from database
    const stocks = await StockModel.find({}, 'symbol').lean();
    const symbols = stocks.map(stock => stock.symbol);
    
    console.log(`Found ${symbols.length} stocks to schedule for updates`);
    
    // Create rotation groups (one for each hour of market)
    const marketHours = 7; // 9:30 AM - 4:00 PM = ~6.5 hours
    const rotationGroups = createRotationGroups(symbols, marketHours);
    
    // Schedule each group for a different hour
    for (let i = 0; i < rotationGroups.length; i++) {
      const hour = MARKET_OPEN_HOUR + i;
      if (hour <= MARKET_CLOSE_HOUR) {
        scheduleHourlyRefresh(hour, rotationGroups[i]);
        console.log(`Scheduled group ${i+1} with ${rotationGroups[i].length} stocks for ${hour}:00`);
      }
    }
    
    console.log('Data refresh scheduler initialized successfully');
  } catch (error) {
    console.error('Error initializing data refresh scheduler:', error.message);
  }
}

// API Routes

/**
 * Get all stocks with optional filtering
 */
app.get('/api/stocks', async (req, res) => {
  try {
    const query = {};
    
    // Apply filters if provided
    if (req.query.exchange) {
      query.exchange = req.query.exchange;
    }
    
    if (req.query.minMarketCap) {
      query.marketCap = { $gte: parseFloat(req.query.minMarketCap) };
    }
    
    if (req.query.maxMarketCap) {
      query.marketCap = { ...query.marketCap, $lte: parseFloat(req.query.maxMarketCap) };
    }
    
    if (req.query.minVolume) {
      query.avgDollarVolume = { $gte: parseFloat(req.query.minVolume) };
    }
    
    if (req.query.maxNetDebtToEBITDA) {
      query.netDebtToEBITDA = { $lte: parseFloat(req.query.maxNetDebtToEBITDA) };
    }
    
    if (req.query.maxEvToEBIT) {
      query.evToEBIT = { $lte: parseFloat(req.query.maxEvToEBIT) };
    }
    
    if (req.query.minRotce) {
      query.rotce = { $gte: parseFloat(req.query.minRotce) };
    }
    
    if (req.query.minScore) {
      query.score = { $gte: parseFloat(req.query.minScore) };
    }
    
    // Get stocks from database
    const stocks = await StockModel.find(query).lean();
    
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stocks:', error.message);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

/**
 * Get stock statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    // Get total count
    const total = await StockModel.countDocuments();
    
    // Get exchange counts
    const nyse = await StockModel.countDocuments({ exchange: { $in: ['XNYS', 'NYSE'] } });
    const nasdaq = await StockModel.countDocuments({ exchange: { $in: ['XNAS', 'NASDAQ'] } });
    
    // Get last updated timestamp
    const lastUpdated = await StockModel.findOne({}, 'lastUpdated')
      .sort({ lastUpdated: -1 })
      .lean();
    
    res.json({
      total,
      nyse,
      nasdaq,
      lastUpdated: lastUpdated?.lastUpdated || new Date()
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Manually trigger data refresh for testing
 */
app.post('/api/refresh', async (req, res) => {
  try {
    const symbol = req.body.symbol;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await updateStockData(symbol);
    
    if (result) {
      res.json({ success: true, message: `Data for ${symbol} refreshed successfully` });
    } else {
      res.status(500).json({ error: `Failed to refresh data for ${symbol}` });
    }
  } catch (error) {
    console.error('Error in manual refresh:', error.message);
    res.status(500).json({ error: 'Failed to refresh data' });
  }
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize data refresh scheduler
  await initializeDataRefreshScheduler();
});

module.exports = app;
