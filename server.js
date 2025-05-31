// Server configuration for Stock Screener application
// Enhanced with better error handling and logging

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockscreener';
console.log(`Attempting to connect to MongoDB at: ${MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://[username]:[password]@')}`);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Don't exit the process, allow the server to start anyway
    console.log('Server will start without database connection. Some features may be limited.');
  });

// Log environment variables (without exposing sensitive values)
console.log('Environment configuration:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`FMP_API_KEY present: ${!!process.env.FMP_API_KEY}`);
console.log(`FMP_API_BASE_URL: ${process.env.FMP_API_BASE_URL || 'https://financialmodelingprep.com/api/v3'}`);
console.log(`PORT: ${process.env.PORT || 3000}`);

// API Routes
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/filters', require('./routes/filters'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(), 
    env: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    api_key_configured: !!process.env.FMP_API_KEY
  });
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Server error', 
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
  console.log(`API endpoints available at:`);
  console.log(`- GET /api/stocks - Get all stocks with pagination`);
  console.log(`- GET /api/stocks/:symbol - Get stock by symbol`);
  console.log(`- POST /api/stocks/refresh/:symbol - Refresh stock data from FMP API`);
  console.log(`- POST /api/stocks/refresh-all - Refresh all stocks from FMP API`);
  console.log(`- GET /health - Server health check`);
});
