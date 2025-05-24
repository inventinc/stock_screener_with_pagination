/**
 * Revalidation Script for Cleaned Stock Database
 * 
 * This script validates the cleaned stock database to ensure:
 * 1. Only NYSE and NASDAQ equities remain
 * 2. No non-equity securities are present
 * 3. P/E Ratio and Dividend Yield coverage is maintained
 */

const mongoose = require('mongoose');
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');

async function validateCleanedData() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Count total stocks
    const totalStocks = await Stock.countDocuments();
    console.log(`Total stocks in cleaned database: ${totalStocks}`);
    
    // Verify exchanges
    const byExchange = await Stock.aggregate([
      { $group: { _id: '$exchange', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\nBreakdown by exchange:');
    byExchange.forEach(ex => {
      console.log(`${ex._id || 'Unknown'}: ${ex.count} stocks`);
    });
    
    // Check for any remaining non-equity securities
    const potentialNonEquities = await Stock.find({
      symbol: { $regex: /[-\.+]|PR[A-Z]|WT|UN|RT|P[A-Z]/ }
    }).limit(10);
    
    console.log('\nRemaining potential non-equities:');
    if (potentialNonEquities.length === 0) {
      console.log('None found - cleanup successful');
    } else {
      console.log(`Found ${potentialNonEquities.length} potential non-equities:`);
      potentialNonEquities.forEach(stock => {
        console.log(`${stock.symbol}: ${stock.name} (${stock.exchange})`);
      });
    }
    
    // Validate P/E Ratio and Dividend Yield coverage
    const stocksWithPE = await Stock.countDocuments({ 
      peRatio: { $ne: null, $exists: true } 
    });
    const pePercentage = (stocksWithPE / totalStocks * 100).toFixed(2);
    console.log(`\nStocks with P/E Ratio: ${stocksWithPE} (${pePercentage}%)`);
    
    const stocksWithDividend = await Stock.countDocuments({ 
      dividendYield: { $ne: null, $exists: true } 
    });
    const dividendPercentage = (stocksWithDividend / totalStocks * 100).toFixed(2);
    console.log(`Stocks with Dividend Yield: ${stocksWithDividend} (${dividendPercentage}%)`);
    
    const stocksWithBoth = await Stock.countDocuments({ 
      peRatio: { $ne: null, $exists: true },
      dividendYield: { $ne: null, $exists: true } 
    });
    const bothPercentage = (stocksWithBoth / totalStocks * 100).toFixed(2);
    console.log(`Stocks with both metrics: ${stocksWithBoth} (${bothPercentage}%)`);
    
    // Analyze by market cap
    console.log('\nAnalysis by Market Cap:');
    const marketCapCategories = [
      { name: 'Large Cap (>$10B)', min: 10000000000, max: Infinity },
      { name: 'Mid Cap ($2B-$10B)', min: 2000000000, max: 10000000000 },
      { name: 'Small Cap ($300M-$2B)', min: 300000000, max: 2000000000 },
      { name: 'Micro Cap (<$300M)', min: 0, max: 300000000 }
    ];
    
    for (const category of marketCapCategories) {
      const totalInCategory = await Stock.countDocuments({ 
        marketCap: { $gte: category.min, $lt: category.max } 
      });
      
      if (totalInCategory === 0) continue;
      
      const withPEInCategory = await Stock.countDocuments({ 
        marketCap: { $gte: category.min, $lt: category.max },
        peRatio: { $ne: null, $exists: true } 
      });
      
      const withDividendInCategory = await Stock.countDocuments({ 
        marketCap: { $gte: category.min, $lt: category.max },
        dividendYield: { $ne: null, $exists: true } 
      });
      
      const peCategoryPercentage = (withPEInCategory / totalInCategory * 100).toFixed(2);
      const dividendCategoryPercentage = (withDividendInCategory / totalInCategory * 100).toFixed(2);
      
      console.log(`${category.name}: ${totalInCategory} stocks`);
      console.log(`  - With P/E Ratio: ${withPEInCategory} (${peCategoryPercentage}%)`);
      console.log(`  - With Dividend Yield: ${withDividendInCategory} (${dividendCategoryPercentage}%)`);
    }
    
    // Sample of stocks with complete data
    console.log('\nSample of stocks with complete data:');
    const sampleStocks = await Stock.find({
      peRatio: { $ne: null, $exists: true },
      dividendYield: { $ne: null, $exists: true }
    })
    .sort({ marketCap: -1 })
    .limit(5)
    .select('symbol name exchange price marketCap peRatio dividendYield');
    
    sampleStocks.forEach(stock => {
      console.log(`${stock.symbol} (${stock.name})`);
      console.log(`  - Exchange: ${stock.exchange}`);
      console.log(`  - Price: $${stock.price?.toFixed(2) || 'N/A'}`);
      console.log(`  - Market Cap: $${(stock.marketCap / 1000000000).toFixed(2)}B`);
      console.log(`  - P/E Ratio: ${stock.peRatio?.toFixed(2) || 'N/A'}`);
      console.log(`  - Dividend Yield: ${stock.dividendYield?.toFixed(2) || 'N/A'}%`);
    });
    
  } catch (error) {
    console.error('Validation failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the validation
validateCleanedData();
