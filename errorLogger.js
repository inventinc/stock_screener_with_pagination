/**
 * Error logging utility for stock screener application
 */

const fs = require('fs');
const path = require('path');

// Log directory
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log files
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');
const RATE_LIMIT_LOG_FILE = path.join(LOG_DIR, 'rate_limit.log');

// Error categories
const ERROR_CATEGORIES = {
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK: 'NETWORK',
  API: 'API',
  FILE_SYSTEM: 'FILE_SYSTEM',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// Recent errors cache
const recentErrors = [];
const MAX_RECENT_ERRORS = 100;

// Error stats
const errorStats = {
  total: 0,
  byCategory: {},
  byEndpoint: {},
  lastError: null
};

/**
 * Categorize error based on message and properties
 * @param {Error} error - Error object
 * @returns {string} - Error category
 */
function categorizeError(error) {
  if (!error) return ERROR_CATEGORIES.UNKNOWN;
  
  const message = error.message || '';
  
  if (message.includes('rate limit') || message.includes('429')) {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }
  
  if (message.includes('ENOTFOUND') || 
      message.includes('ETIMEDOUT') || 
      message.includes('ECONNREFUSED') ||
      message.includes('ECONNRESET')) {
    return ERROR_CATEGORIES.NETWORK;
  }
  
  if (message.includes('ENOENT') || 
      message.includes('EACCES') || 
      message.includes('EPERM')) {
    return ERROR_CATEGORIES.FILE_SYSTEM;
  }
  
  if (error.response && error.response.status) {
    return ERROR_CATEGORIES.API;
  }
  
  return ERROR_CATEGORIES.UNKNOWN;
}

/**
 * Log error to file and update stats
 * @param {Error} error - Error object
 * @param {string} context - Error context
 * @param {Object} metadata - Additional metadata
 */
function logError(error, context = '', metadata = {}) {
  try {
    if (!error) return;
    
    // Categorize error
    const category = error.category || categorizeError(error);
    
    // Create error entry
    const errorEntry = {
      timestamp: new Date().toISOString(),
      category,
      context,
      message: error.message || 'Unknown error',
      stack: error.stack,
      metadata
    };
    
    // Add to recent errors
    recentErrors.unshift(errorEntry);
    if (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.pop();
    }
    
    // Update stats
    errorStats.total++;
    errorStats.lastError = errorEntry;
    
    if (!errorStats.byCategory[category]) {
      errorStats.byCategory[category] = 0;
    }
    errorStats.byCategory[category]++;
    
    if (metadata.endpoint) {
      if (!errorStats.byEndpoint[metadata.endpoint]) {
        errorStats.byEndpoint[metadata.endpoint] = 0;
      }
      errorStats.byEndpoint[metadata.endpoint]++;
    }
    
    // Format log entry
    const logEntry = `[${errorEntry.timestamp}] [${category}] ${context}: ${error.message}\n${
      error.stack ? error.stack + '\n' : ''
    }${JSON.stringify(metadata, null, 2)}\n${'='.repeat(80)}\n`;
    
    // Write to appropriate log file
    if (category === ERROR_CATEGORIES.RATE_LIMIT) {
      fs.appendFileSync(RATE_LIMIT_LOG_FILE, logEntry);
      console.log(`[${category}] ${context}: ${error.message}`);
    } else {
      fs.appendFileSync(ERROR_LOG_FILE, logEntry);
      console.error(`[${category}] ${context}: ${error.message}`);
    }
  } catch (loggingError) {
    console.error('Error in error logger:', loggingError);
  }
}

/**
 * Get recent errors
 * @param {string} category - Filter by category
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} - Recent errors
 */
function getRecentErrors(category = null, limit = 10) {
  if (category) {
    return recentErrors
      .filter(error => error.category === category)
      .slice(0, limit);
  }
  
  return recentErrors.slice(0, limit);
}

/**
 * Get error statistics
 * @returns {Object} - Error statistics
 */
function getErrorStats() {
  return {
    ...errorStats,
    recentErrorCount: recentErrors.length
  };
}

// Export functions
module.exports = {
  logError,
  getRecentErrors,
  getErrorStats,
  categorizeError,
  ERROR_CATEGORIES
};
