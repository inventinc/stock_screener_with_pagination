/**
 * Daily Stock Data Refresh Script
 * 
 * This script refreshes all stock data using the ultra-optimized FMP import script.
 * It can be run manually or set up as a cron job on your hosting platform.
 * 
 * Usage:
 * - Manual: node refresh_stock_data.js
 * - Cron job: Set up on your hosting platform to run daily after market close
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Log file path
const logFilePath = path.join(logsDir, 'refresh_log.txt');

// Log function
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  console.log(message);
};

// Main refresh function
async function refreshStockData() {
  try {
    log('Starting daily stock data refresh...');
    
    // Record start time
    const startTime = Date.now();
    
    // Run the ultra-optimized import script
    log('Running ultra-optimized FMP import script...');
    execSync('node ultra_optimized_fmp_import.js', { stdio: 'inherit' });
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    
    log(`Stock data refresh completed successfully in ${duration} minutes`);
    
    // Run validation script to check data quality
    log('Validating refreshed data...');
    execSync('node validate_cleaned_data.js', { stdio: 'inherit' });
    
    log('Daily refresh process completed');
    return true;
  } catch (error) {
    log(`Error during refresh: ${error.message}`);
    return false;
  }
}

// Execute the refresh
refreshStockData().then(success => {
  if (!success) {
    process.exit(1);
  }
});
