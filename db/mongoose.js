/**
 * MongoDB connection module for the stock screener application
 * Handles connection to MongoDB with proper error handling and connection pooling
 */

const mongoose = require('mongoose');
const { logError } = require('../errorLogger');
const config = require('./config');

/**
 * Connect to MongoDB
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
  try {
    // Get configuration based on environment
    const dbConfig = await config.getConfig();
    
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(dbConfig.uri, dbConfig.options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up connection event handlers
    mongoose.connection.on('error', err => {
      logError('MongoDB connection error:', err);
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    logError('MongoDB connection failed:', error);
    console.error('MongoDB connection failed:', error);
    process.exit(1); // Exit with failure
  }
};

module.exports = {
  connectDB,
  mongoose
};
