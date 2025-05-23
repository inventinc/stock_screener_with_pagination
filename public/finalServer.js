/**
 * Final improved server.js with optimized routes for handling 5,700+ stocks
 * Includes performance optimizations and support for smaller batch sizes (50-75)
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
require('dotenv').config();

// Import database connection
const { connectDB } = require('./db/mongoose');
const Stock = require('./db/models/Stock');

// Import route modules
const stockRoutes = require('./routes/stockRoutes');
const globalStatsRoute = require('./routes/globalStatsRoute');
const { setupRefreshRoutes } = require('./refreshRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(compression()); // Add compression for better performance
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h' // Add cache control for static assets
}));

// Connect to MongoDB with optimized settings
connectDB()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api', stockRoutes);
app.use('/api', globalStatsRoute);

// Setup refresh routes
setupRefreshRoutes(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.3.0'
  });
});

// Memory usage endpoint for monitoring
app.get('/api/system/memory', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    timestamp: new Date()
  });
});

// Serve the final version
app.get('/final', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'finalIndex.html'));
});

// Serve the improved version for the previous path
app.get('/improved', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'improvedIndex.html'));
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server started at ${new Date().toISOString()}`);
  console.log(`Final version available at /final`);
});
