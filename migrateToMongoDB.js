/**
 * Data migration script to transfer stock data from JSON files to MongoDB
 * Reads from existing JSON files and populates MongoDB collections
 */

const fs = require('fs').promises;
const path = require('path');
const { connectDB } = require('./db/mongoose');
const stocksDAO = require('./db/stocksDAO');
const { logError } = require('./errorLogger');

// Path to JSON data file
const DATA_DIR = path.join(__dirname, 'data');
const ALL_STOCKS_FILE = path.join(DATA_DIR, 'all_stocks.json');

/**
 * Main migration function
 */
async function migrateDataToMongoDB() {
  console.log('Starting data migration from JSON to MongoDB...');
  
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Read the existing JSON data
    console.log(`Reading data from ${ALL_STOCKS_FILE}...`);
    const jsonData = await fs.readFile(ALL_STOCKS_FILE, 'utf8');
    const parsedData = JSON.parse(jsonData);
    
    // Handle both formats: array of stocks or object with stocks array
    let stocks;
    if (Array.isArray(parsedData)) {
      console.log('Detected array format in JSON file');
      stocks = parsedData;
    } else if (parsedData && parsedData.stocks && Array.isArray(parsedData.stocks)) {
      console.log('Detected object with stocks array format in JSON file');
      stocks = parsedData.stocks;
    } else {
      throw new Error('Invalid or empty stock data in JSON file');
    }
    
    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
      throw new Error('No valid stock data found in JSON file');
    }
    
    console.log(`Found ${stocks.length} stocks in JSON file`);
    
    // Process stocks in batches to avoid memory issues with large datasets
    const BATCH_SIZE = 100;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE);
      try {
        // Insert batch into MongoDB
        await stocksDAO.bulkCreateOrUpdateStocks(batch);
        successCount += batch.length;
      } catch (error) {
        errorCount += batch.length;
        logError('Error migrating batch:', error);
        console.error(`Error migrating batch ${i / BATCH_SIZE + 1}:`, error.message);
      }
      
      processedCount += batch.length;
      console.log(`Processed ${processedCount}/${stocks.length} stocks (${Math.round(processedCount / stocks.length * 100)}%)`);
    }
    
    // Get final stats
    const stats = await stocksDAO.getStockStats();
    
    console.log('\nMigration completed:');
    console.log(`- Total stocks processed: ${processedCount}`);
    console.log(`- Successfully migrated: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log('\nMongoDB Stats:');
    console.log(`- Total stocks in MongoDB: ${stats.total}`);
    console.log(`- NYSE stocks: ${stats.nyse}`);
    console.log(`- NASDAQ stocks: ${stats.nasdaq}`);
    console.log(`- Last updated: ${stats.lastUpdated}`);
    
    return {
      success: true,
      processed: processedCount,
      succeeded: successCount,
      failed: errorCount,
      stats
    };
  } catch (error) {
    logError('Migration failed:', error);
    console.error('Migration failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrateDataToMongoDB()
    .then(result => {
      if (result.success) {
        console.log('Migration completed successfully');
      } else {
        console.error('Migration failed:', result.error);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error during migration:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { migrateDataToMongoDB };
}
