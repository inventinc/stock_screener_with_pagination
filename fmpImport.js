/**
 * FMP Import Module
 * 
 * This module handles importing stock data from Financial Modeling Prep API
 * and storing it in MongoDB.
 */

const mongoose = require('mongoose');
const fmpApiService = require('./fmpApiService');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB';

// Stock model schema
const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: String,
  exchange: String,
  sector: String,
  industry: String,
  price: Number,
  marketCap: Number,
  avgDollarVolume: Number,
  netDebtToEBITDA: Number,
  evToEBIT: Number,
  rotce: Number,
  fcfToNetIncome: Number,
  shareCountGrowth: Number,
  priceToBook: Number,
  insiderOwnership: Number,
  revenueGrowth: Number,
  score: Number,
  lastUpdated: { type: Date, default: Date.now }
});

// Create or get the Stock model
let Stock;
try {
  Stock = mongoose.model('Stock');
} catch (e) {
  Stock = mongoose.model('Stock', stockSchema);
}

/**
 * Import all stocks from FMP
 * @returns {Promise<void>}
 */
async function importAllStocks() {
  try {
    console.log('Starting stock import from Financial Modeling Prep...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Get all stock symbols
    const stocks = await fmpApiService.getAllStocks();
    console.log(`Found ${stocks.length} stocks to import`);
    
    // Process stocks in batches to avoid rate limits
    const batchSize = 20;
    const totalBatches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)`);
      
      // Process batch in parallel
      const promises = batch.map(async (stock) => {
        try {
          // Get detailed stock data
          const stockData = await fmpApiService.getStockData(stock.symbol);
          
          if (!stockData) {
            console.log(`No data found for ${stock.symbol}, skipping`);
            return null;
          }
          
          // Update or insert stock in database
          await Stock.findOneAndUpdate(
            { symbol: stockData.symbol },
            stockData,
            { upsert: true, new: true }
          );
          
          console.log(`Imported ${stockData.symbol} - ${stockData.name}`);
          return stockData.symbol;
        } catch (error) {
          console.error(`Error importing ${stock.symbol}:`, error.message);
          return null;
        }
      });
      
      // Wait for batch to complete
      const results = await Promise.all(promises);
      const successCount = results.filter(Boolean).length;
      
      console.log(`Batch ${batchNumber} complete: ${successCount}/${batch.length} stocks imported successfully`);
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < stocks.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Count total stocks in database
    const totalStocks = await Stock.countDocuments();
    console.log(`Import complete. Total stocks in database: ${totalStocks}`);
    
  } catch (error) {
    console.error('Error importing stocks:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

/**
 * Refresh stock data for existing stocks in database
 * @param {number} limit - Maximum number of stocks to refresh
 * @returns {Promise<void>}
 */
async function refreshStocks(limit = 100) {
  try {
    console.log(`Starting refresh for up to ${limit} stocks...`);
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Get oldest updated stocks
    const stocks = await Stock.find({})
      .sort({ lastUpdated: 1 })
      .limit(limit);
    
    console.log(`Found ${stocks.length} stocks to refresh`);
    
    // Process stocks in batches
    const batchSize = 10;
    const totalBatches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)`);
      
      // Process batch in parallel
      const promises = batch.map(async (stock) => {
        try {
          // Get updated stock data
          const stockData = await fmpApiService.getStockData(stock.symbol);
          
          if (!stockData) {
            console.log(`No data found for ${stock.symbol}, skipping`);
            return null;
          }
          
          // Update stock in database
          await Stock.findOneAndUpdate(
            { symbol: stockData.symbol },
            stockData,
            { new: true }
          );
          
          console.log(`Refreshed ${stockData.symbol} - ${stockData.name}`);
          return stockData.symbol;
        } catch (error) {
          console.error(`Error refreshing ${stock.symbol}:`, error.message);
          return null;
        }
      });
      
      // Wait for batch to complete
      const results = await Promise.all(promises);
      const successCount = results.filter(Boolean).length;
      
      console.log(`Batch ${batchNumber} complete: ${successCount}/${batch.length} stocks refreshed successfully`);
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < stocks.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('Refresh complete');
    
  } catch (error) {
    console.error('Error refreshing stocks:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

module.exports = {
  importAllStocks,
  refreshStocks
};
