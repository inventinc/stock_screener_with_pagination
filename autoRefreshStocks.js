/**
 * Automated Stock Data Refresh Script for Heroku
 * 
 * This script automatically refreshes stock data from Financial Modeling Prep API.
 * It can be scheduled to run periodically using Heroku Scheduler.
 * 
 * Usage:
 * - Manual: node autoRefreshStocks.js
 * - Heroku Scheduler: Add as a scheduled job
 */

const fmpImport = require('./fmpImport');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, 'auto_refresh_log.txt');

// Log function
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  console.log(message);
};

// Main refresh function
async function autoRefreshStocks() {
  try {
    log('Starting automated stock data refresh...');
    
    // Record start time
    const startTime = Date.now();
    
    // Check if database is empty (first run)
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB');
    
    const Stock = mongoose.model('Stock');
    const stockCount = await Stock.countDocuments();
    
    await mongoose.connection.close();
    
    if (stockCount === 0) {
      // First run - import all stocks
      log('Database is empty. Running full import...');
      await fmpImport.importAllStocks();
    } else {
      // Regular refresh - update oldest stocks
      log(`Database has ${stockCount} stocks. Running refresh for oldest 100 stocks...`);
      await fmpImport.refreshStocks(100);
    }
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    
    log(`Stock data refresh completed successfully in ${duration} minutes`);
    
    return true;
  } catch (error) {
    log(`Error during refresh: ${error.message}`);
    return false;
  }
}

// Execute the refresh
autoRefreshStocks().then(success => {
  if (!success) {
    process.exit(1);
  }
});
