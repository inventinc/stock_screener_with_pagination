const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');

/**
 * @route   GET /api/filters/market-cap
 * @desc    Filter stocks by market cap category
 * @access  Public
 */
router.get('/market-cap/:category', async (req, res) => {
  try {
    const { category } = req.params;
    let query = {};
    
    switch (category) {
      case 'large':
        query.marketCap = { $gte: 10000000000 }; // $10B+
        break;
      case 'mid':
        query.marketCap = { $gte: 2000000000, $lt: 10000000000 }; // $2B-$10B
        break;
      case 'small':
        query.marketCap = { $gte: 300000000, $lt: 2000000000 }; // $300M-$2B
        break;
      case 'micro':
        query.marketCap = { $lt: 300000000 }; // <$300M
        break;
      default:
        return res.status(400).json({ message: 'Invalid market cap category' });
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price marketCap');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/volume
 * @desc    Filter stocks by volume category
 * @access  Public
 */
router.get('/volume/:category', async (req, res) => {
  try {
    const { category } = req.params;
    let query = {};
    
    switch (category) {
      case 'high':
        query.volAvg = { $gte: 1000000 }; // 1M+
        break;
      case 'medium':
        query.volAvg = { $gte: 100000, $lt: 1000000 }; // 100K-1M
        break;
      case 'low':
        query.volAvg = { $lt: 100000 }; // <100K
        break;
      default:
        return res.status(400).json({ message: 'Invalid volume category' });
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price volAvg');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/debt
 * @desc    Filter stocks by debt category
 * @access  Public
 */
router.get('/debt/:category', async (req, res) => {
  try {
    const { category } = req.params;
    let query = {};
    
    switch (category) {
      case 'low':
        query['financials.debtToEquity'] = { $lt: 0.3 };
        break;
      case 'medium':
        query['financials.debtToEquity'] = { $gte: 0.3, $lt: 0.6 };
        break;
      case 'high':
        query['financials.debtToEquity'] = { $gte: 0.6 };
        break;
      default:
        return res.status(400).json({ message: 'Invalid debt category' });
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.debtToEquity');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/debt-ebitda
 * @desc    Filter stocks by Debt/EBITDA ratio
 * @access  Public
 */
router.get('/debt-ebitda/:threshold', async (req, res) => {
  try {
    const threshold = parseFloat(req.params.threshold);
    
    if (isNaN(threshold)) {
      return res.status(400).json({ message: 'Invalid threshold value' });
    }
    
    const query = {
      'financials.debtToEbitda': { $lte: threshold }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.debtToEbitda');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/fcf-ni
 * @desc    Filter stocks by FCF/NI ratio
 * @access  Public
 */
router.get('/fcf-ni/:threshold', async (req, res) => {
  try {
    const threshold = parseFloat(req.params.threshold);
    
    if (isNaN(threshold)) {
      return res.status(400).json({ message: 'Invalid threshold value' });
    }
    
    const query = {
      'financials.fcfToNi': { $gte: threshold }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.fcfToNi');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/ev-ebit
 * @desc    Filter stocks by EV/EBIT ratio
 * @access  Public
 */
router.get('/ev-ebit/:threshold', async (req, res) => {
  try {
    const threshold = parseFloat(req.params.threshold);
    
    if (isNaN(threshold)) {
      return res.status(400).json({ message: 'Invalid threshold value' });
    }
    
    const query = {
      'financials.evToEbit': { $lte: threshold }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.evToEbit');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/rotce
 * @desc    Filter stocks by ROTCE category
 * @access  Public
 */
router.get('/rotce/:category', async (req, res) => {
  try {
    const { category } = req.params;
    let query = {};
    
    switch (category) {
      case 'excellent':
        query['financials.rotce'] = { $gt: 20 };
        break;
      case 'good':
        query['financials.rotce'] = { $gt: 15, $lte: 20 };
        break;
      case 'average':
        query['financials.rotce'] = { $gt: 10, $lte: 15 };
        break;
      case 'poor':
        query['financials.rotce'] = { $lte: 10 };
        break;
      default:
        return res.status(400).json({ message: 'Invalid ROTCE category' });
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.rotce');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/moat-keywords
 * @desc    Filter stocks by moat keyword count
 * @access  Public
 */
router.get('/moat-keywords/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count);
    
    if (isNaN(count)) {
      return res.status(400).json({ message: 'Invalid count value' });
    }
    
    const query = {
      'qualitative.moatKeywords.count': { $gte: count }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price qualitative.moatKeywords');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/insider-ownership
 * @desc    Filter stocks by insider ownership percentage
 * @access  Public
 */
router.get('/insider-ownership/:percentage', async (req, res) => {
  try {
    const percentage = parseFloat(req.params.percentage);
    
    if (isNaN(percentage)) {
      return res.status(400).json({ message: 'Invalid percentage value' });
    }
    
    const query = {
      'qualitative.insiderOwnership': { $gte: percentage }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price qualitative.insiderOwnership');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/insider-buys
 * @desc    Filter stocks by net insider buys
 * @access  Public
 */
router.get('/insider-buys/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count);
    
    if (isNaN(count)) {
      return res.status(400).json({ message: 'Invalid count value' });
    }
    
    const query = {
      'qualitative.insiderBuys': { $gte: count }
    };
    
    const stocks = await Stock.find(query).select('symbol companyName sector price qualitative.insiderBuys');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/margin-trend
 * @desc    Filter stocks by gross margin trend
 * @access  Public
 */
router.get('/margin-trend/:trend', async (req, res) => {
  try {
    const { trend } = req.params;
    
    if (!['improving', 'stable', 'declining', 'any'].includes(trend)) {
      return res.status(400).json({ message: 'Invalid trend value' });
    }
    
    let query = {};
    
    if (trend !== 'any') {
      query['financials.grossMarginTrend'] = trend;
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price financials.grossMargin financials.grossMarginTrend');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/filters/exclude-flags
 * @desc    Filter stocks by excluding red flags
 * @access  Public
 */
router.get('/exclude-flags/:flag', async (req, res) => {
  try {
    const { flag } = req.params;
    let query = {};
    
    switch (flag) {
      case 'audit':
        query['qualitative.redFlags.auditChanges'] = false;
        break;
      case 'management':
        query['qualitative.redFlags.managementExits'] = false;
        break;
      case 'all':
        query['qualitative.redFlags.hasAnyRedFlags'] = false;
        break;
      default:
        return res.status(400).json({ message: 'Invalid flag value' });
    }
    
    const stocks = await Stock.find(query).select('symbol companyName sector price qualitative.redFlags');
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**

/**
 * @route   GET /api/filters/ranking/:method
 * @desc    Get stocks based on new ranking methods
 */
router.get('/ranking/:method', async (req, res) => {
  const method = req.params.method;
  const Stock = require('../models/Stock');
  let query = {};

  try {
    switch (method) {
      case 'founders-fortune':
        query = {
          'ownership.insiderPercent': { $gt: 0.1 },
          'financials.debtToEbitda': { $lt: 2 },
          'financials.revenueGrowth': { $gt: 0.1 },
          'financials.fcfToNi': { $gt: 1 },
          'shares.outstandingGrowth': { $lt: 0 }  // Assuming this field exists
        };
        break;

      case 'hidden-moat':
        query = {
          'financials.roic': { $gt: 0.15 },
          'financials.grossMargin': { $gt: 0.4 },
          'financials.evToEbit': { $lt: 12 },
          'financials.debtToEquity': { $lt: 1 }
        };
        break;

      case 'resilient-income':
        query = {
          'dividends.yield': { $gt: 0.03 },
          'dividends.growth': { $gt: 0 },
          'dividends.payoutRatio': { $lt: 0.75 },
          'financials.debtToEbitda': { $lt: 2 },
          'financials.operatingMargin': { $gt: 0.15 },
          'beta': { $lt: 1.2 }
        };
        break;

      default:
        return res.status(400).json({ message: 'Invalid ranking method' });
    }

    const stocks = await Stock.find(query)
      .select('symbol companyName sector price marketCap financials dividends ownership shares beta')
      .limit(50);

    res.json(stocks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
    
    switch (method) {
      case 'owner-earnings':
        sortField = 'ranking.ownerEarningsYield';
        break;
      case 'rotce':
        sortField = 'ranking.rotceScore';
        break;
      case 'combined':
        sortField = 'ranking.combinedScore';
        break;
      default:
        return res.status(400).json({ message: 'Invalid ranking method' });
    }
    
    const stocks = await Stock.find({})
      .select(`symbol companyName sector price ${sortField}`)
      .sort({ [sortField]: -1 }) // Descending order (highest first)
      .limit(100);
      
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/filters/combined
 * @desc    Apply multiple filters at once
 * @access  Public
 */
router.post('/combined', async (req, res) => {
  try {
    const { filters } = req.body;
    
    if (!filters || !Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({ message: 'Invalid filters format' });
    }
    
    // Build MongoDB query from filters
    const query = {};
    
    filters.forEach(filter => {
      const { type, value } = filter;
      
      switch (type) {
        case 'market-cap':
          if (value === 'large') query.marketCap = { $gte: 10000000000 };
          else if (value === 'mid') query.marketCap = { $gte: 2000000000, $lt: 10000000000 };
          else if (value === 'small') query.marketCap = { $gte: 300000000, $lt: 2000000000 };
          else if (value === 'micro') query.marketCap = { $lt: 300000000 };
          break;
          
        case 'volume':
          if (value === 'high') query.volAvg = { $gte: 1000000 };
          else if (value === 'medium') query.volAvg = { $gte: 100000, $lt: 1000000 };
          else if (value === 'low') query.volAvg = { $lt: 100000 };
          break;
          
        case 'debt':
          if (value === 'low') query['financials.debtToEquity'] = { $lt: 0.3 };
          else if (value === 'medium') query['financials.debtToEquity'] = { $gte: 0.3, $lt: 0.6 };
          else if (value === 'high') query['financials.debtToEquity'] = { $gte: 0.6 };
          break;
          
        case 'debt-ebitda':
          query['financials.debtToEbitda'] = { $lte: parseFloat(value) };
          break;
          
        case 'fcf-ni':
          query['financials.fcfToNi'] = { $gte: parseFloat(value) };
          break;
          
        case 'ev-ebit':
          query['financials.evToEbit'] = { $lte: parseFloat(value) };
          break;
          
        case 'rotce':
          if (value === 'excellent') query['financials.rotce'] = { $gt: 20 };
          else if (value === 'good') query['financials.rotce'] = { $gt: 15, $lte: 20 };
          else if (value === 'average') query['financials.rotce'] = { $gt: 10, $lte: 15 };
          else if (value === 'poor') query['financials.rotce'] = { $lte: 10 };
          break;
          
        case 'moat-keywords':
          query['qualitative.moatKeywords.count'] = { $gte: parseInt(value) };
          break;
          
        case 'insider-ownership':
          query['qualitative.insiderOwnership'] = { $gte: parseFloat(value) };
          break;
          
        case 'insider-buys':
          query['qualitative.insiderBuys'] = { $gte: parseInt(value) };
          break;
          
        case 'margin-trend':
          if (value !== 'any') query['financials.grossMarginTrend'] = value;
          break;
          
        case 'exclude-flags':
          if (value === 'audit') query['qualitative.redFlags.auditChanges'] = false;
          else if (value === 'management') query['qualitative.redFlags.managementExits'] = false;
          else if (value === 'all') query['qualitative.redFlags.hasAnyRedFlags'] = false;
          break;
      }
    });
    
    // Get ranking method if provided
    const { ranking } = req.body;
    let sortField = 'symbol'; // Default sort
    
    if (ranking) {
      switch (ranking) {
        case 'owner-earnings':
          sortField = 'ranking.ownerEarningsYield';
          break;
        case 'rotce':
          sortField = 'ranking.rotceScore';
          break;
        case 'combined':
          sortField = 'ranking.combinedScore';
          break;
      }
    }
    
    // Get pagination parameters
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Execute query with pagination
    const stocks = await Stock.find(query)
      .select('symbol companyName sector price marketCap volAvg financials.debtToEquity financials.debtToEbitda financials.fcfToNi financials.evToEbit financials.rotce ranking')
      .sort({ [sortField]: -1 })
      .skip(skip)
      .limit(limit);
      
    // Get total count for pagination
    const total = await Stock.countDocuments(query);
    
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
 * @route   GET /api/filters/search/:query
 * @desc    Search stocks by symbol, name, or sector
 * @access  Public
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    const searchRegex = new RegExp(query, 'i');
    
    const stocks = await Stock.find({
      $or: [
        { symbol: searchRegex },
        { companyName: searchRegex },
        { sector: searchRegex }
      ]
    })
    .select('symbol companyName sector price marketCap')
    .limit(50);
    
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
