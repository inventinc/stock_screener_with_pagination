/**
 * Stock schema for MongoDB
 * Defines the structure and indexes for stock data
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

// Create and export the model
const Stock = mongoose.model('Stock', StockSchema);

module.exports = Stock;
