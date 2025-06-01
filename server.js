require('dotenv').config();

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const PQueue = require('p-queue');
const app = express();
const port = process.env.PORT || 3000;

// Add middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

mongoose.connect(mongoURI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Add timeout
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  mongoose.connection.close()
    .then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
});

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
app.get('/', (req, res) => {
  res.send('Hello World!');
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