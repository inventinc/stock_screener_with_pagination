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

    if (req.query.marketCapCategory) {
      // Assuming you have a field like 'marketCapCategory' stored in your schema
      // You would need logic in your background job to calculate and save this category
      filter.marketCapCategory = req.query.marketCapCategory;
    }

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
    res.status(500).json({ error: 'Error fetching stocks' });
  }
});

app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});