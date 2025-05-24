/**
 * Stock schema for MongoDB - OPTIMIZED VERSION
 * Enhanced with strategic indexes for better query performance
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the stock schema with appropriate types and indexes
const StockSchema = new Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  exchange: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  sector: {
    type: String,
    index: true,
    trim: true
  },
  industry: {
    type: String,
    index: true,
    trim: true
  },
  price: {
    type: Number,
    default: null
  },
  marketCap: {
    type: Number,
    index: true,
    default: null
  },
  avgDollarVolume: {
    type: Number,
    index: true,
    default: null
  },
  netDebtToEBITDA: {
    type: Number,
    index: true,
    default: null
  },
  evToEBIT: {
    type: Number,
    index: true,
    default: null
  },
  rotce: {
    type: Number,
    index: true,
    default: null
  },
  score: {
    type: Number,
    index: true,
    default: null
  },
  peRatio: {
    type: Number,
    index: true,
    default: null
  },
  dividendYield: {
    type: Number,
    index: true,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  strict: false // Allows for additional fields not defined in schema
});

// Create compound indexes for common filter combinations
StockSchema.index({ exchange: 1, marketCap: -1 });
StockSchema.index({ score: -1, marketCap: -1 });
StockSchema.index({ sector: 1, score: -1 });
StockSchema.index({ industry: 1, score: -1 });

// OPTIMIZATION: Add strategic compound indexes for common filter combinations
// Market cap and volume (very common filter combination)
StockSchema.index({ marketCap: -1, avgDollarVolume: -1 });

// Debt and PE ratio filters (common for value investors)
StockSchema.index({ netDebtToEBITDA: 1, peRatio: 1 });

// Dividend yield and market cap (common for income investors)
StockSchema.index({ dividendYield: -1, marketCap: -1 });

// Score and debt (common for quality filters)
StockSchema.index({ score: -1, netDebtToEBITDA: 1 });

// Exchange and volume (common for liquidity filters)
StockSchema.index({ exchange: 1, avgDollarVolume: -1 });

// OPTIMIZATION: Add text index for faster text search
StockSchema.index({ symbol: 'text', name: 'text' }, {
  weights: {
    symbol: 10, // Symbol matches are more important
    name: 5
  }
});

// Add instance methods if needed
StockSchema.methods.toJSON = function() {
  const stock = this.toObject();
  return stock;
};

// Add static methods for common queries
StockSchema.statics.findBySymbol = function(symbol) {
  return this.findOne({ symbol: symbol.toUpperCase() });
};

StockSchema.statics.findByExchange = function(exchange) {
  return this.find({ exchange });
};

// OPTIMIZATION: Add additional static methods for common query patterns
StockSchema.statics.findLargeCapStocks = function(limit = 100) {
  return this.find({ marketCap: { $gte: 10000000000 } })
    .sort({ marketCap: -1 })
    .limit(limit)
    .lean();
};

StockSchema.statics.findHighVolumeStocks = function(limit = 100) {
  return this.find({ avgDollarVolume: { $gte: 5000000 } })
    .sort({ avgDollarVolume: -1 })
    .limit(limit)
    .lean();
};

StockSchema.statics.findLowDebtStocks = function(limit = 100) {
  return this.find({ 
    netDebtToEBITDA: { $gte: 0, $lte: 0.5 } 
  })
    .sort({ netDebtToEBITDA: 1 })
    .limit(limit)
    .lean();
};

StockSchema.statics.findUndervaluedStocks = function(limit = 100) {
  return this.find({ 
    peRatio: { $gt: 0, $lt: 15 } 
  })
    .sort({ peRatio: 1 })
    .limit(limit)
    .lean();
};

// Create and export the model
const Stock = mongoose.model('Stock', StockSchema);

module.exports = Stock;
