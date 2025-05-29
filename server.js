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

// Import FMP API service
const fmpApiService = require('./fmp_api_service');

// Import custom Debt/EBITDA calculator
const debtEBITDACalculator = require('./fmp_debt_ebitda_calculator');

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
    
    console.log(`Refreshing data for ${symbol} using FMP API...`);
    
    // Fetch comprehensive financial data from FMP API
    const financialData = await fmpApiService.fetchComprehensiveFinancialData(symbol);
    
    if (!financialData || !financialData.quote) {
      return res.status(404).json({ error: 'No financial data found for this symbol' });
    }
    
    // Extract data from FMP response
    const { profile, quote, ratios, incomeStatement, balanceSheet, keyMetrics } = financialData;
    
    // Extract basic data
    let price = quote?.price || 0;
    let marketCap = quote?.marketCap || profile?.mktCap || 0;
    let avgVolume = quote?.avgVolume || 0;
    let avgDollarVolume = avgVolume * price;
    
    // Extract financial metrics
    let netDebtToEBITDA = null;
    let evToEBIT = null;
    let rotce = null;
    let peRatio = null;
    let dividendYield = null;
    
    // Get Debt/EBITDA from ratios if available
    if (ratios) {
      // Important: Check for null/undefined before assignment
      if (ratios.netDebtToEBITDA !== undefined && ratios.netDebtToEBITDA !== null) {
        netDebtToEBITDA = ratios.netDebtToEBITDA;
        console.log(`Using direct netDebtToEBITDA from ratios: ${netDebtToEBITDA}`);
      } else if (ratios.debtToEBITDA !== undefined && ratios.debtToEBITDA !== null) {
        netDebtToEBITDA = ratios.debtToEBITDA;
        console.log(`Using direct debtToEBITDA from ratios: ${netDebtToEBITDA}`);
      } else {
        console.log('Ratio fields exist but Debt/EBITDA values are null/undefined');
      }
      
      peRatio = ratios.peRatio || (quote?.pe !== undefined ? quote.pe : null);
      dividendYield = ratios.dividendYield || (profile?.lastDiv && price ? profile.lastDiv / price : null);
    }
    
    // If Debt/EBITDA not available directly, calculate it
    if (netDebtToEBITDA === undefined || netDebtToEBITDA === null) {
      // Prepare financial data for custom calculation
      const financialsForCalculation = {
        longTermDebt: balanceSheet?.longTermDebt,
        shortTermDebt: balanceSheet?.shortTermDebt,
        debt: balanceSheet?.totalDebt,
        currentDebt: balanceSheet?.shortTermDebt,
        netIncome: incomeStatement?.netIncome,
        interestExpense: incomeStatement?.interestExpense,
        incomeTaxExpense: incomeStatement?.incomeTaxExpense,
        depreciation: incomeStatement?.depreciationAndAmortization,
        amortization: 0, // Often included in depreciationAndAmortization
        operatingIncome: incomeStatement?.operatingIncome,
        ebit: incomeStatement?.ebit,
        ebitda: incomeStatement?.ebitda || keyMetrics?.ebitda
      };
      
      // Calculate using custom calculator
      const calculationResult = debtEBITDACalculator.calculateDebtToEBITDA(financialsForCalculation);
      
      if (calculationResult.hasAllComponents && calculationResult.value !== null) {
        netDebtToEBITDA = calculationResult.value;
        console.log(`Calculated Debt/EBITDA for ${symbol}: ${netDebtToEBITDA} using method: ${calculationResult.method}`);
      }
    }
    
    // Get EV/EBIT
    if (ratios) {
      evToEBIT = ratios.enterpriseValueOverEBIT || 0;
    }
    
    // Calculate ROTCE
    if (incomeStatement && balanceSheet) {
      const netIncome = incomeStatement.netIncome || 0;
      const totalEquity = balanceSheet.totalStockholdersEquity || 0;
      const intangibleAssets = balanceSheet.intangibleAssets || 0;
      const tangibleEquity = totalEquity - intangibleAssets;
      
      if (tangibleEquity > 0 && netIncome) {
        rotce = netIncome / tangibleEquity;
      }
    }
    
    // Calculate score
    const score = calculateScore({
      marketCap,
      netDebtToEBITDA,
      evToEBIT,
      rotce
    });
    
    // Prepare stock data for database
    const stockData = {
      symbol,
      name: profile?.companyName || '',
      exchange: profile?.exchangeShortName || '',
      sector: profile?.sector || '',
      industry: profile?.industry || '',
      price,
      marketCap,
      avgDollarVolume,
      peRatio,
      dividendYield,
      netDebtToEBITDA,
      evToEBIT,
      rotce,
      score,
      lastUpdated: new Date()
    };
    
    // Update or create stock in database
    const stock = await Stock.findOneAndUpdate(
      { symbol },
      stockData,
      { new: true, upsert: true }
    );
    
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
  if (details.netDebtToEBITDA === null || details.netDebtToEBITDA === undefined) {
    score += 10; // Neutral score for missing data
    console.log(`${symbol} Debt score: 10 (missing data)`);
  } else if (!isFinite(details.netDebtToEBITDA)) {
    score += 5; // Low score for infinite debt ratio
    console.log(`${symbol} Debt score: 5 (infinite ratio)`);
  } else if (details.netDebtToEBITDA < 1) {
    score += 20;
    console.log(`${symbol} Debt score: 20 (< 1)`);
  } else if (details.netDebtToEBITDA < 2) {
    score += 15;
    console.log(`${symbol} Debt score: 15 (< 2)`);
  } else if (details.netDebtToEBITDA < 3) {
    score += 10;
    console.log(`${symbol} Debt score: 10 (< 3)`);
  } else {
    score += 5;
    console.log(`${symbol} Debt score: 5 (>= 3)`);
  }
  
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

// Helper function to refresh stocks in background using FMP API
async function refreshStocksInBackground(stocks) {
  for (const stock of stocks) {
    try {
      console.log(`Background refresh for ${stock.symbol} using FMP API...`);
      
      // Fetch comprehensive financial data from FMP API
      const financialData = await fmpApiService.fetchComprehensiveFinancialData(stock.symbol);
      
      if (!financialData || !financialData.quote) {
        console.log(`No financial data found for ${stock.symbol}, skipping...`);
        continue;
      }
      
      // Extract data from FMP response
      const { profile, quote, ratios, incomeStatement, balanceSheet, keyMetrics } = financialData;
      
      // Extract basic data
      let price = quote?.price || 0;
      let marketCap = quote?.marketCap || profile?.mktCap || 0;
      let avgVolume = quote?.avgVolume || 0;
      let avgDollarVolume = avgVolume * price;
      
      // Extract financial metrics
      let netDebtToEBITDA = null;
      let evToEBIT = 0;
      let rotce = 0;
      let peRatio = 0;
      let dividendYield = 0;
      
      // Get Debt/EBITDA from ratios if available
      if (ratios) {
        netDebtToEBITDA = ratios.netDebtToEBITDA || ratios.debtToEBITDA;
        peRatio = ratios.peRatio || quote?.pe || 0;
        dividendYield = ratios.dividendYield || (profile?.lastDiv ? profile.lastDiv / price : 0);
      }
      
      // If Debt/EBITDA not available directly, calculate it
      if (netDebtToEBITDA === undefined || netDebtToEBITDA === null) {
        // Prepare financial data for custom calculation
        const financialsForCalculation = {
          longTermDebt: balanceSheet?.longTermDebt,
          shortTermDebt: balanceSheet?.shortTermDebt,
          debt: balanceSheet?.totalDebt,
          currentDebt: balanceSheet?.shortTermDebt,
          netIncome: incomeStatement?.netIncome,
          interestExpense: incomeStatement?.interestExpense,
          incomeTaxExpense: incomeStatement?.incomeTaxExpense,
          depreciation: incomeStatement?.depreciationAndAmortization,
          amortization: 0, // Often included in depreciationAndAmortization
          operatingIncome: incomeStatement?.operatingIncome,
          ebit: incomeStatement?.ebit,
          ebitda: incomeStatement?.ebitda || keyMetrics?.ebitda
        };
        
        // Calculate using custom calculator
        const calculationResult = debtEBITDACalculator.calculateDebtToEBITDA(financialsForCalculation);
        
        if (calculationResult.hasAllComponents && calculationResult.value !== null) {
          netDebtToEBITDA = calculationResult.value;
          console.log(`Calculated Debt/EBITDA for ${stock.symbol}: ${netDebtToEBITDA} using method: ${calculationResult.method}`);
        }
      }
      
      // Get EV/EBIT
      if (ratios) {
        evToEBIT = ratios.enterpriseValueOverEBIT || 0;
      }
      
      // Calculate ROTCE
      if (incomeStatement && balanceSheet) {
        const netIncome = incomeStatement.netIncome || 0;
        const totalEquity = balanceSheet.totalStockholdersEquity || 0;
        const intangibleAssets = balanceSheet.intangibleAssets || 0;
        const tangibleEquity = totalEquity - intangibleAssets;
        
        if (tangibleEquity > 0 && netIncome) {
          rotce = netIncome / tangibleEquity;
        }
      }
      
      // Calculate score
      const score = calculateScore({
        marketCap,
        netDebtToEBITDA,
        evToEBIT,
        rotce
      });
      
      // Prepare stock data for database
      const stockData = {
        symbol: stock.symbol,
        name: profile?.companyName || stock.name || '',
        exchange: profile?.exchangeShortName || stock.exchange || '',
        sector: profile?.sector || stock.sector || '',
        industry: profile?.industry || stock.industry || '',
        price,
        marketCap,
        avgDollarVolume,
        peRatio,
        dividendYield,
        netDebtToEBITDA,
        evToEBIT,
        rotce,
        score,
        lastUpdated: new Date()
      };
      
      // Update stock in database
      await Stock.findByIdAndUpdate(stock._id, stockData);
      
      console.log(`Successfully updated ${stock.symbol}`);
      
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
