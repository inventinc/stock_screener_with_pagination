const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const fmpService = require('../services/fmpService');

/**
 * @route   GET /api/stocks
 * @desc    Get all stocks with pagination
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/stocks - Fetching stocks with pagination');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    console.log(`Pagination params: page=${page}, limit=${limit}, skip=${skip}`);
    
    const stocks = await Stock.find()
      .select('symbol companyName sector price marketCap volAvg financials.debtToEbitda financials.fcfToNi financials.evToEbit financials.rotce ranking.combinedScore')
      .skip(skip)
      .limit(limit);
      
    const total = await Stock.countDocuments();
    
    console.log(`Found ${stocks.length} stocks out of ${total} total`);
    
    if (stocks.length === 0) {
      console.log('No stocks found in database. Attempting to fetch sample data.');
      
      // If no stocks in database, return sample data
      const sampleStocks = [
        { 
          symbol: 'AAPL', 
          companyName: 'Apple Inc.', 
          sector: 'Technology', 
          price: 198.45, 
          marketCap: 3200000000000,
          volAvg: 80000000,
          financials: {
            debtToEbitda: 0.32,
            fcfToNi: 1.12,
            evToEbit: 8.7,
            rotce: 42.3
          },
          ranking: {
            combinedScore: 87
          }
        },
        { 
          symbol: 'MSFT', 
          companyName: 'Microsoft Corporation', 
          sector: 'Technology', 
          price: 412.78, 
          marketCap: 3100000000000,
          volAvg: 25000000,
          financials: {
            debtToEbitda: 0.45,
            fcfToNi: 0.98,
            evToEbit: 9.2,
            rotce: 38.7
          },
          ranking: {
            combinedScore: 82
          }
        },
        { 
          symbol: 'GOOG', 
          companyName: 'Alphabet Inc.', 
          sector: 'Technology', 
          price: 176.32, 
          marketCap: 2200000000000,
          volAvg: 20000000,
          financials: {
            debtToEbitda: 0.28,
            fcfToNi: 1.05,
            evToEbit: 7.8,
            rotce: 35.2
          },
          ranking: {
            combinedScore: 85
          }
        }
      ];
      
      console.log('Returning sample data with 3 stocks');
      
      return res.json({
        stocks: sampleStocks,
        pagination: {
          total: sampleStocks.length,
          page: 1,
          limit: sampleStocks.length,
          pages: 1
        },
        source: 'sample'
      });
    }
    
    res.json({
      stocks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      source: 'database'
    });
  } catch (err) {
    console.error('Error in GET /api/stocks:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/stocks/:symbol
 * @desc    Get stock by symbol
 * @access  Public
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log(`GET /api/stocks/${symbol} - Fetching stock by symbol`);
    
    const stock = await Stock.findOne({ symbol });
    
    if (!stock) {
      console.log(`Stock not found in database: ${symbol}`);
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    console.log(`Successfully retrieved stock: ${symbol}`);
    res.json(stock);
  } catch (err) {
    console.error(`Error in GET /api/stocks/${req.params.symbol}:`, err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   POST /api/stocks/refresh/:symbol
 * @desc    Refresh stock data from FMP API
 * @access  Public
 */
router.post('/refresh/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log(`POST /api/stocks/refresh/${symbol} - Refreshing stock data from FMP API`);
    
    // Check if API key is configured
    if (!process.env.FMP_API_KEY) {
      console.error('FMP_API_KEY is not configured');
      return res.status(500).json({ 
        message: 'API key not configured', 
        error: 'FMP_API_KEY environment variable is missing' 
      });
    }
    
    // Get company profile
    const profile = await fmpService.getCompanyProfile(symbol);
    
    if (!profile) {
      console.log(`No profile found for ${symbol} in FMP API`);
      return res.status(404).json({ message: 'Stock not found in FMP API' });
    }
    
    console.log(`Successfully retrieved profile for ${symbol}, fetching additional data...`);
    
    // Get financial data
    const ratios = await fmpService.getFinancialRatios(symbol);
    const metrics = await fmpService.getKeyMetrics(symbol);
    const cashFlow = await fmpService.getCashFlowStatement(symbol);
    const income = await fmpService.getIncomeStatement(symbol);
    const balance = await fmpService.getBalanceSheet(symbol);
    const insiderTransactions = await fmpService.getInsiderTransactions(symbol);
    
    // Process and calculate metrics
    const latestRatio = ratios.length > 0 ? ratios[0] : {};
    const latestMetrics = metrics.length > 0 ? metrics[0] : {};
    const latestCashFlow = cashFlow.length > 0 ? cashFlow[0] : {};
    const latestIncome = income.length > 0 ? income[0] : {};
    const latestBalance = balance.length > 0 ? balance[0] : {};
    
    // Calculate FCF/NI ratio
    const fcfToNi = latestIncome.netIncome && latestIncome.netIncome !== 0 
      ? latestCashFlow.freeCashFlow / latestIncome.netIncome 
      : null;
    
    // Calculate Debt/EBITDA
    const debtToEbitda = latestIncome.ebitda && latestIncome.ebitda !== 0
      ? (latestBalance.totalDebt || 0) / latestIncome.ebitda
      : null;
    
    // Calculate EV/EBIT
    const evToEbit = latestIncome.ebit && latestIncome.ebit !== 0
      ? latestMetrics.enterpriseValue / latestIncome.ebit
      : null;
    
    // Calculate ROTCE
    const tangibleEquity = (latestBalance.totalStockholdersEquity || 0) - 
      (latestBalance.goodwillAndIntangibleAssets || 0);
    
    const rotce = tangibleEquity && tangibleEquity > 0
      ? (latestIncome.netIncome / tangibleEquity) * 100
      : null;
    
    // Calculate gross margin trend
    let grossMarginTrend = 'stable';
    if (ratios.length >= 3) {
      const currentGrossMargin = ratios[0].grossProfitMargin;
      const prevGrossMargin = ratios[1].grossProfitMargin;
      const prevPrevGrossMargin = ratios[2].grossProfitMargin;
      
      if (currentGrossMargin > prevGrossMargin && prevGrossMargin > prevPrevGrossMargin) {
        grossMarginTrend = 'improving';
      } else if (currentGrossMargin < prevGrossMargin && prevGrossMargin < prevPrevGrossMargin) {
        grossMarginTrend = 'declining';
      }
    }
    
    // Calculate insider ownership and buys
    let insiderOwnership = profile.mktCap ? 
      ((profile.insiderShares || 0) / (profile.mktCap / profile.price)) * 100 : 0;
    
    let insiderBuys = 0;
    if (insiderTransactions && insiderTransactions.length > 0) {
      // Count net buys in the last 12 months
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      insiderTransactions.forEach(transaction => {
        const transactionDate = new Date(transaction.transactionDate);
        if (transactionDate >= oneYearAgo) {
          if (transaction.transactionType === 'Buy') {
            insiderBuys++;
          } else if (transaction.transactionType === 'Sell') {
            insiderBuys--;
          }
        }
      });
    }
    
    // Check for red flags
    const auditChanges = false; // Would need additional data source
    const managementExits = false; // Would need additional data source
    const hasAnyRedFlags = auditChanges || managementExits;
    
    // Calculate ranking scores
    const ownerEarningsYield = latestMetrics.enterpriseValue && latestMetrics.enterpriseValue > 0
      ? ((latestCashFlow.freeCashFlow || 0) + (latestIncome.depreciationAndAmortization || 0)) / latestMetrics.enterpriseValue * 100
      : 0;
    
    const rotceScore = rotce || 0;
    
    // Combined score (weighted average)
    const combinedScore = (ownerEarningsYield * 0.6) + (rotceScore * 0.4);
    
    // Scan description for moat keywords
    const moatKeywords = [
      'competitive advantage', 'moat', 'market leader', 'brand recognition',
      'switching costs', 'network effect', 'patent', 'proprietary', 'economies of scale',
      'cost advantage', 'high margin', 'recurring revenue'
    ];
    
    let moatKeywordCount = 0;
    const foundKeywords = [];
    
    if (profile.description) {
      const descLower = profile.description.toLowerCase();
      moatKeywords.forEach(keyword => {
        if (descLower.includes(keyword.toLowerCase())) {
          moatKeywordCount++;
          foundKeywords.push(keyword);
        }
      });
    }
    
    // Create or update stock in database
    let stock = await Stock.findOne({ symbol });
    
    const stockData = {
      symbol: profile.symbol,
      companyName: profile.companyName,
      sector: profile.sector,
      industry: profile.industry,
      marketCap: profile.mktCap,
      price: profile.price,
      beta: profile.beta,
      volAvg: profile.volAvg,
      lastDiv: profile.lastDiv,
      range: profile.range,
      changes: profile.changes,
      exchange: profile.exchange,
      description: profile.description,
      website: profile.website,
      ceo: profile.ceo,
      isEtf: profile.isEtf || false,
      financials: {
        debtToEquity: latestRatio.debtToEquity,
        debtToEbitda: debtToEbitda,
        fcfToNi: fcfToNi,
        evToEbit: evToEbit,
        rotce: rotce,
        roic: latestRatio.returnOnInvestedCapital,
        peRatio: latestRatio.priceEarningsRatio,
        pbRatio: latestRatio.priceToBookRatio,
        dividendYield: latestRatio.dividendYield,
        revenueGrowth: latestRatio.revenueGrowth,
        grossMargin: latestRatio.grossProfitMargin,
        grossMarginTrend: grossMarginTrend,
        incrementalRoic: null // Would need additional calculation
      },
      qualitative: {
        moatKeywords: {
          count: moatKeywordCount,
          keywords: foundKeywords
        },
        insiderOwnership: insiderOwnership,
        insiderBuys: insiderBuys,
        redFlags: {
          auditChanges: auditChanges,
          managementExits: managementExits,
          hasAnyRedFlags: hasAnyRedFlags
        }
      },
      ranking: {
        ownerEarningsYield: ownerEarningsYield,
        rotceScore: rotceScore,
        combinedScore: combinedScore,
        previousRanks: []
      },
      lastUpdated: new Date()
    };
    
    console.log(`Processed data for ${symbol}, saving to database...`);
    
    if (stock) {
      // If stock exists, update it
      if (stock.ranking && stock.ranking.combinedScore) {
        // Store previous rank
        stockData.ranking.previousRanks = [
          {
            date: stock.lastUpdated,
            rank: stock.ranking.combinedScore
          },
          ...stock.ranking.previousRanks.slice(0, 11) // Keep last 12 months
        ];
      }
      
      stock = await Stock.findOneAndUpdate(
        { symbol },
        { $set: stockData },
        { new: true }
      );
      
      console.log(`Updated existing stock: ${symbol}`);
    } else {
      // If stock doesn't exist, create it
      stock = new Stock(stockData);
      await stock.save();
      
      console.log(`Created new stock: ${symbol}`);
    }
    
    res.json(stock);
  } catch (err) {
    console.error(`Error in POST /api/stocks/refresh/${req.params.symbol}:`, err);
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }
});

/**
 * @route   POST /api/stocks/refresh-all
 * @desc    Refresh all stocks from FMP API
 * @access  Public
 */
router.post('/refresh-all', async (req, res) => {
  try {
    console.log('POST /api/stocks/refresh-all - Refreshing all stocks from FMP API');
    
    // Check if API key is configured
    if (!process.env.FMP_API_KEY) {
      console.error('FMP_API_KEY is not configured');
      return res.status(500).json({ 
        message: 'API key not configured', 
        error: 'FMP_API_KEY environment variable is missing' 
      });
    }
    
    // Get all stock symbols from FMP API
    const symbols = await fmpService.getAllStockSymbols();
    
    if (!symbols || symbols.length === 0) {
      console.error('No stocks found in FMP API');
      return res.status(404).json({ message: 'No stocks found in FMP API' });
    }
    
    console.log(`Retrieved ${symbols.length} symbols from FMP API`);
    
    // Start background refresh process
    res.json({ 
      message: `Started refresh process for ${symbols.length} stocks`,
      totalStocks: symbols.length
    });
    
    // Process stocks in batches to avoid rate limits
    const batchSize = 5;
    const delay = 1000; // 1 second delay between batches
    
    console.log(`Processing stocks in batches of ${batchSize} with ${delay}ms delay between batches`);
    
    // For testing, just process a few stocks
    const testSymbols = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'FB'];
    const limitedSymbols = symbols.filter(s => testSymbols.includes(s.symbol));
    
    if (limitedSymbols.length > 0) {
      console.log(`For testing, only processing these symbols: ${testSymbols.join(', ')}`);
      
      // Process test symbols
      for (const stockData of limitedSymbols) {
        try {
          const symbol = stockData.symbol;
          console.log(`Processing test symbol: ${symbol}`);
          
          // Call refresh endpoint for each symbol
          const response = await fetch(`${req.protocol}://${req.get('host')}/api/stocks/refresh/${symbol}`, {
            method: 'POST'
          });
          
          if (!response.ok) {
            console.error(`Error refreshing ${symbol}: ${response.status} ${response.statusText}`);
          } else {
            console.log(`Successfully refreshed ${symbol}`);
          }
        } catch (error) {
          console.error(`Error processing ${stockData.symbol}:`, error);
        }
      }
      
      console.log('Finished processing test symbols');
      return;
    }
    
    // Process all symbols in batches
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(symbols.length/batchSize)}`);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (stockData) => {
        try {
          const symbol = stockData.symbol;
          
          // Skip if not a US stock or if it's an ETF/index
          if (!symbol || symbol.includes('^') || symbol.includes('.')) {
            console.log(`Skipping ${symbol} - not a regular US stock`);
            return;
          }
          
          console.log(`Processing ${symbol}`);
          
          // Call refresh endpoint for each symbol
          const response = await fetch(`${req.protocol}://${req.get('host')}/api/stocks/refresh/${symbol}`, {
            method: 'POST'
          });
          
          if (!response.ok) {
            console.error(`Error refreshing ${symbol}: ${response.status} ${response.statusText}`);
          } else {
            console.log(`Successfully refreshed ${symbol}`);
          }
        } catch (error) {
          console.error(`Error processing ${stockData.symbol}:`, error);
        }
      }));
      
      // Delay between batches
      if (i + batchSize < symbols.length) {
        console.log(`Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log('Finished processing all stocks');
  } catch (err) {
    console.error('Error in POST /api/stocks/refresh-all:', err);
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }
});

module.exports = router;
