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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const stocks = await Stock.find()
      .select('symbol companyName sector price marketCap volAvg')
      .skip(skip)
      .limit(limit);
      
    const total = await Stock.countDocuments();
    
    res.json({
      stocks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
    const stock = await Stock.findOne({ symbol });
    
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
    
    // Get company profile
    const profile = await fmpService.getCompanyProfile(symbol);
    
    if (!profile) {
      return res.status(404).json({ message: 'Stock not found in FMP API' });
    }
    
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
    } else {
      // If stock doesn't exist, create it
      stock = new Stock(stockData);
      await stock.save();
    }
    
    res.json(stock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/stocks/refresh-all
 * @desc    Refresh all stocks from FMP API
 * @access  Public
 */
router.post('/refresh-all', async (req, res) => {
  try {
    // Get all stock symbols from FMP API
    const symbols = await fmpService.getAllStockSymbols();
    
    if (!symbols || symbols.length === 0) {
      return res.status(404).json({ message: 'No stocks found in FMP API' });
    }
    
    // Start background refresh process
    res.json({ 
      message: `Started refresh process for ${symbols.length} stocks`,
      totalStocks: symbols.length
    });
    
    // Process stocks in batches to avoid rate limits
    const batchSize = 5;
    const delay = 1000; // 1 second delay between batches
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (stockData) => {
        try {
          const symbol = stockData.symbol;
          
          // Skip if not a US stock or if it's an ETF/index
          if (!symbol || symbol.includes('^') || symbol.includes('.')) {
            return;
          }
          
          // Call refresh endpoint for each symbol
          await fetch(`${req.protocol}://${req.get('host')}/api/stocks/refresh/${symbol}`, {
            method: 'POST'
          });
        } catch (error) {
          console.error(`Error refreshing ${stockData.symbol}:`, error);
        }
      }));
      
      // Delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
