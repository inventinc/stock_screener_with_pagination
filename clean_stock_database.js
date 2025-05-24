/**
 * Stock Database Cleanup Script
 * 
 * This script cleans the stock database to:
 * 1. Standardize exchange names (map to NYSE or NASDAQ)
 * 2. Remove non-equity securities
 * 3. Keep only NYSE and NASDAQ stocks
 */

const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');

// Exchange name mapping
const exchangeMapping = {
  'New York Stock Exchange': 'NYSE',
  'XNYS': 'NYSE',
  'NYSE': 'NYSE',
  'NASDAQ Global Select': 'NASDAQ',
  'NASDAQ Global Market': 'NASDAQ',
  'NASDAQ Capital Market': 'NASDAQ',
  'NASDAQ': 'NASDAQ',
  'XNAS': 'NASDAQ'
};

// Function to identify non-equity securities based on symbol patterns
function isNonEquity(symbol) {
  // Check for preferred shares, warrants, units, rights, etc.
  return /[-\.+]/.test(symbol) || 
         /\bPR[A-Z]\b/.test(symbol) || 
         /\bWT\b/.test(symbol) || 
         /\bUN\b/.test(symbol) || 
         /\bRT\b/.test(symbol) ||
         /\bP[A-Z]\b/.test(symbol);
}

async function cleanDatabase() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Count initial stocks
    const initialCount = await Stock.countDocuments();
    console.log(`Initial stock count: ${initialCount}`);
    
    // Step 1: Standardize exchange names
    console.log('\nStandardizing exchange names...');
    let standardizedCount = 0;
    
    for (const [originalName, standardName] of Object.entries(exchangeMapping)) {
      const result = await Stock.updateMany(
        { exchange: originalName },
        { $set: { exchange: standardName } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Standardized ${result.modifiedCount} stocks from "${originalName}" to "${standardName}"`);
        standardizedCount += result.modifiedCount;
      }
    }
    
    console.log(`Total standardized exchanges: ${standardizedCount}`);
    
    // Step 2: Remove non-equity securities
    console.log('\nRemoving non-equity securities...');
    
    // Find symbols of non-equity securities
    const nonEquityStocks = await Stock.find({
      symbol: { $regex: /[-\.+]|PR[A-Z]|WT|UN|RT|P[A-Z]/ }
    }).select('symbol');
    
    const nonEquitySymbols = nonEquityStocks.map(stock => stock.symbol);
    console.log(`Found ${nonEquitySymbols.length} potential non-equity securities`);
    
    // Delete non-equity securities
    if (nonEquitySymbols.length > 0) {
      const deleteResult = await Stock.deleteMany({
        symbol: { $in: nonEquitySymbols }
      });
      
      console.log(`Deleted ${deleteResult.deletedCount} non-equity securities`);
    }
    
    // Step 3: Keep only NYSE and NASDAQ stocks
    console.log('\nKeeping only NYSE and NASDAQ stocks...');
    
    const deleteOtherExchanges = await Stock.deleteMany({
      exchange: { $nin: ['NYSE', 'NASDAQ'] }
    });
    
    console.log(`Deleted ${deleteOtherExchanges.deletedCount} stocks from other exchanges`);
    
    // Final count
    const finalCount = await Stock.countDocuments();
    console.log(`\nFinal stock count: ${finalCount}`);
    console.log(`Removed ${initialCount - finalCount} stocks in total`);
    
    // Count by exchange
    const nyseCount = await Stock.countDocuments({ exchange: 'NYSE' });
    const nasdaqCount = await Stock.countDocuments({ exchange: 'NASDAQ' });
    
    console.log(`\nNYSE stocks: ${nyseCount}`);
    console.log(`NASDAQ stocks: ${nasdaqCount}`);
    console.log(`Total NYSE + NASDAQ: ${nyseCount + nasdaqCount}`);
    
  } catch (error) {
    console.error('Database cleanup failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the cleanup
cleanDatabase();
