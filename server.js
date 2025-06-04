require('dotenv').config();

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const stockSchema = new mongoose.Schema({
  // From /api/v3/profile/{symbol}
  symbol: { type: String, required: true, unique: true },
  companyName: { type: String },
  image: { type: String },
  website: { type: String },
  description: { type: String },
  sector: { type: String },
  industry: { type: String },
 ceo: { type: String },
  fullTimeEmployees: { type: Number },
 price: { type: Number }, // Can be updated by /quote later for real-time
  mktCap: { type: Number }, // Can be updated by /quote later for real-time
  volAvg: { type: Number }, // Can be updated by /quote later for real-time
  lastDiv: { type: Number },
  range: { type: String }, // e.g., "100 - 200"
 yearHigh: { type: Number }, // Derived from range or from /quote
 yearLow: { type: Number }, // Derived from range or from /quote

  // From /api/v3/quote/{symbol} - Data here can update/confirm profile data
 // symbol and name are already in profile, can use quote for potentially more real-time price/marketCap/avgVolume
 marketCap: { type: Number }, // Already in profile, kept for potential update frequency
 avgVolume: { type: Number }, // Already in profile, kept for potential update frequency
  yearHighQuote: { type: Number }, // Explicitly from quote if needed
  yearLowQuote: { type: Number }, // Explicitly from quote if needed
  peQuote: { type: Number }, // P/E from quote

  // From /api/v3/ratios-ttm/{symbol}
  priceEarningsRatioTTM: { type: Number },
  debtEquityRatioTTM: { type: Number },
  returnOnEquityTTM: { type: Number },
  returnOnTangibleEquityTTM: { type: Number },
  netIncomePerShareTTM: { type: Number },

  // From /api/v3/key-metrics-ttm/{symbol}
  debtToEbitdaTTM: { type: Number },
  enterpriseValueOverEBITDATTM: { type: Number },
  freeCashFlowPerShareTTM: { type: Number },

  lastUpdated: { type: Date, default: Date.now },

  // Derived fields
  simpleScore: { type: Number },
  marketCapCategory: { type: String },
  volumeCategory: { type: String },
  debtCategory: { type: String },
  valuationCategory: { type: String },
  rotceCategory: { type: String },
  numericDebtEbitdaCategory: { type: String },
  numericFcfNiCategory: { type: String },

  // Formatted strings
  debtEbitda: { type: String },
  evEbit: { type: String }, // Note: This will store EV/EBITDA formatted as EV/EBIT
  fcfNi: { type: String },
  rotce: { type: String }, // Note: This will store ROE TTM formatted as ROTCE
  dividendYield: { type: String },
  fiftyTwoWeekHigh: { type: String },
  fiftyTwoWeekLow: { type: String },


});
const Stock = mongoose.model('Stock', stockSchema);

// Serve static files from the React app build directory
app.use(express.static('public/dist'));

// Serve the React app for all non-API routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/dist/index.html');
});

stockSchema.index({ symbol: 1 }); // Index for faster lookups by symbol

app.get('/api/v1/stocks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default limit
    const skip = (page - 1) * limit;
    const sort = {};
    const filter = {};

    // Basic Filtering
    if (req.query.sector) {
      filter.sector = req.query.sector;
    }

    // Market Cap filtering with proper mapping
    if (req.query.marketCapCategory) {
      filter.marketCapCategory = req.query.marketCapCategory;
    } else if (req.query.marketCap) {
      // Map frontend filter values to database values
      const marketCapMap = {
        'large': 'midLarge',
        'midLarge': 'midLarge',
        'small': 'small',
        'micro': 'micro',
        'nano': 'nano'
      };
      if (marketCapMap[req.query.marketCap]) {
        filter.marketCapCategory = marketCapMap[req.query.marketCap];
      }
    }

    // Volume filtering with proper mapping
    if (req.query.volumeCategory) {
      filter.volumeCategory = req.query.volumeCategory;
    } else if (req.query.volume) {
      // Map frontend filter values to database values
      const volumeMap = {
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
      };
      if (volumeMap[req.query.volume]) {
        filter.volumeCategory = volumeMap[req.query.volume];
      }
    }

    // Capital Structure Filters
    // Debt/Equity Ratio filtering
    if (req.query.debtCategory) {
      filter.debtCategory = req.query.debtCategory;
    } else if (req.query.debt || req.query.debtEquityRatio) {
      const debtValue = req.query.debt || req.query.debtEquityRatio;
      const debtMap = {
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      };
      if (debtMap[debtValue]) {
        filter.debtCategory = debtMap[debtValue];
      }
    }

    // Debt/EBITDA filtering
    if (req.query.numericDebtEbitdaCategory) {
      filter.numericDebtEbitdaCategory = req.query.numericDebtEbitdaCategory;
    } else if (req.query.debtToEbitda) {
      const debtEbitdaMap = {
        'le1x': 'le1x',
        'le0.5x': 'le0.5x', 
        'le0.25x': 'le0.25x'
      };
      if (debtEbitdaMap[req.query.debtToEbitda]) {
        filter.numericDebtEbitdaCategory = debtEbitdaMap[req.query.debtToEbitda];
      }
    }

    // Profitability Filters
    // ROE/ROTCE filtering with proper mapping
    if (req.query.rotceCategory) {
      filter.rotceCategory = req.query.rotceCategory;
    } else if (req.query.roe) {
      const roeMap = {
        'excellent': 'excellent',
        'good': 'good',
        'average': 'average',
        'poor': 'poor'
      };
      if (roeMap[req.query.roe]) {
        filter.rotceCategory = roeMap[req.query.roe];
      }
    }

    // FCF/Net Income filtering
    if (req.query.numericFcfNiCategory) {
      filter.numericFcfNiCategory = req.query.numericFcfNiCategory;
    } else if (req.query.fcfToNetIncome) {
      const fcfNiMap = {
        'ge0.8': 'ge0.8',
        'ge1.0': 'ge1.0',
        'ge1.2': 'ge1.2'
      };
      if (fcfNiMap[req.query.fcfToNetIncome]) {
        filter.numericFcfNiCategory = fcfNiMap[req.query.fcfToNetIncome];
      }
    }

    // Gross Margin Trend filtering (placeholder - would need database field)
    if (req.query.gmTrend) {
      // Note: This would require a grossMarginTrend field in the database
      // For now, we'll skip this filter as the field doesn't exist
      console.log('Gross margin trend filter requested but not implemented:', req.query.gmTrend);
    }

    // Capital Discipline Filters (placeholders - would need database fields)
    if (req.query.incRoic) {
      // Note: This would require an incrementalRoic field in the database
      console.log('Incremental ROIC filter requested but not implemented:', req.query.incRoic);
    }

    if (req.query.shareCountChange) {
      // Note: This would require a shareCountChange field in the database
      console.log('Share count change filter requested but not implemented:', req.query.shareCountChange);
    }

    // Valuation Filters
    // P/E Ratio / Valuation filtering with proper mapping
    if (req.query.valuationCategory) {
      filter.valuationCategory = req.query.valuationCategory;
    } else if (req.query.peRatio || req.query.valuation) {
      const valuationValue = req.query.peRatio || req.query.valuation;
      const valuationMap = {
        'value': 'value',
        'growth': 'growth',
        'blend': 'blend'
      };
      if (valuationMap[valuationValue]) {
        filter.valuationCategory = valuationMap[valuationValue];
      }
    }

    // EV/EBITDA filtering (placeholder - would need database field)
    if (req.query.evToEbit) {
      // Note: This would require an evToEbitCategory field in the database
      console.log('EV/EBITDA filter requested but not implemented:', req.query.evToEbit);
    }

    // Price/NCAV filtering (placeholder - would need database field)
    if (req.query.priceToNCAV) {
      // Note: This would require a priceToNCAV field in the database
      console.log('Price/NCAV filter requested but not implemented:', req.query.priceToNCAV);
    }

    // Ownership & Governance Filters (placeholders - would need database fields)
    if (req.query.insiderOwn) {
      // Note: This would require an insiderOwnership field in the database
      console.log('Insider ownership filter requested but not implemented:', req.query.insiderOwn);
    }

    if (req.query.netInsiderTrx) {
      // Note: This would require a netInsiderTransactions field in the database
      console.log('Net insider transactions filter requested but not implemented:', req.query.netInsiderTrx);
    }

    if (req.query.rdFlags) {
      // Note: This would require red flags fields in the database
      console.log('Red flags filter requested but not implemented:', req.query.rdFlags);
    }

    // Qualitative & Catalysts Filters (placeholders - would need database fields)
    if (req.query.moatKws) {
      // Note: This would require a moatKeywords field in the database
      console.log('Moat keywords filter requested but not implemented:', req.query.moatKws);
    }

    console.log('Applied filters:', filter);

    // Sorting
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[req.query.sortBy] = sortOrder;
    } else {
      // Default sort order, e.g., by marketCap descending
      sort.marketCap = -1;
    }

    // Execute the query with filtering, sorting, and pagination
    const stocks = await Stock.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    // Get the total count of documents matching the filter for pagination info
    const totalItems = await Stock.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    // Format the response
    const response = {
      data: stocks,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching stocks from database:', error.message);

    // Provide a small sample dataset when MongoDB isn't reachable so the
    // frontend can continue to function during local development or when
    // network access to the database is temporarily unavailable.
    const sampleData = [
      {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        price: 150,
        simpleScore: 75,
        sector: 'Technology'
      }
    ];

    res.json({
      data: sampleData,
      pagination: { currentPage: 1, totalPages: 1, totalItems: sampleData.length }
    });
  }
});

app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});