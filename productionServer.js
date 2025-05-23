/**
 * Production server for stock screener application
 * Combines backend API with frontend static files
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const scoreCalculator = require('./scoreCalculator');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// API endpoint to get all stocks
app.get('/api/stocks', (req, res) => {
  try {
    // Read stocks from file
    const stocksFile = path.join(__dirname, 'data', 'all_stocks.json');
    
    if (!fs.existsSync(stocksFile)) {
      return res.status(404).json({ error: 'Stocks data not found' });
    }
    
    const stocksData = fs.readFileSync(stocksFile, 'utf8');
    let stocks = JSON.parse(stocksData);
    
    // Calculate scores for all stocks
    stocks = stocks.map(stock => {
      const score = scoreCalculator.calculateStockScore(stock);
      return { ...stock, score };
    });
    
    // Get import status
    const statusFile = path.join(__dirname, 'data', 'import_status.json');
    let importStatus = { status: 'unknown', lastRun: null };
    
    if (fs.existsSync(statusFile)) {
      const statusData = fs.readFileSync(statusFile, 'utf8');
      importStatus = JSON.parse(statusData);
    }
    
    // Return stocks with import status
    res.json({
      stocks,
      importStatus,
      stats: {
        total: stocks.length,
        nyse: stocks.filter(s => s.exchange === 'XNYS').length,
        nasdaq: stocks.filter(s => s.exchange === 'XNAS').length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// API endpoint to get import status
app.get('/api/import-status', (req, res) => {
  try {
    const statusFile = path.join(__dirname, 'data', 'import_status.json');
    
    if (!fs.existsSync(statusFile)) {
      return res.status(404).json({ error: 'Import status not found' });
    }
    
    const statusData = fs.readFileSync(statusFile, 'utf8');
    const importStatus = JSON.parse(statusData);
    
    res.json(importStatus);
  } catch (error) {
    console.error('Error fetching import status:', error);
    res.status(500).json({ error: 'Failed to fetch import status' });
  }
});

// API endpoint to get batch progress
app.get('/api/batch-progress', (req, res) => {
  try {
    const batchProgressFile = path.join(__dirname, 'data', 'batch_progress.json');
    
    if (!fs.existsSync(batchProgressFile)) {
      return res.status(404).json({ error: 'Batch progress not found' });
    }
    
    const batchProgressData = fs.readFileSync(batchProgressFile, 'utf8');
    const batchProgress = JSON.parse(batchProgressData);
    
    res.json(batchProgress);
  } catch (error) {
    console.error('Error fetching batch progress:', error);
    res.status(500).json({ error: 'Failed to fetch batch progress' });
  }
});

// For any other GET request, send the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
  
  // Start the adaptive import process in the background
  try {
    const adaptiveImport = require('./adaptiveImport');
    console.log('Starting adaptive import process in the background...');
    adaptiveImport.importAllStocksAdaptive()
      .then(() => {
        console.log('Adaptive import completed successfully');
      })
      .catch(error => {
        console.error('Error in adaptive import:', error.message);
      });
  } catch (error) {
    console.error('Failed to start adaptive import:', error.message);
  }
});
