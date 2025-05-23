/**
 * Production server for stock screener application
 * Combines backend API and serves frontend static files
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const polygonClient = require('./polygonClient');
const highSpeedImport = require('./highSpeedImport');
const errorLogger = require('./errorLogger');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Data files
const DATA_DIR = path.join(__dirname, 'data');
const ALL_STOCKS_FILE = path.join(DATA_DIR, 'all_stocks.json');
const BATCH_PROGRESS_FILE = path.join(DATA_DIR, 'batch_progress.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize all_stocks.json if it doesn't exist
if (!fs.existsSync(ALL_STOCKS_FILE)) {
  fs.writeFileSync(ALL_STOCKS_FILE, JSON.stringify([]));
}

// Initialize batch_progress.json if it doesn't exist
if (!fs.existsSync(BATCH_PROGRESS_FILE)) {
  fs.writeFileSync(BATCH_PROGRESS_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    currentBatch: 0,
    totalBatches: 0,
    totalSymbols: 0,
    processedSymbols: 0,
    successfulSymbols: 0,
    failedSymbols: 0,
    errors: []
  }));
}

// Get all stocks
app.get('/api/stocks', (req, res) => {
  try {
    // Read stocks data
    const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
    let stocks = JSON.parse(stocksData);
    
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortField = req.query.sortField || 'marketCap';
    const sortDirection = req.query.sortDirection || 'desc';
    
    // Apply filters
    let filteredStocks = stocks;
    
    // Market cap filter
    if (req.query.marketCapMin) {
      const min = parseFloat(req.query.marketCapMin);
      filteredStocks = filteredStocks.filter(stock => 
        stock.marketCap !== null && stock.marketCap >= min
      );
    }
    
    if (req.query.marketCapMax) {
      const max = parseFloat(req.query.marketCapMax);
      filteredStocks = filteredStocks.filter(stock => 
        stock.marketCap !== null && stock.marketCap <= max
      );
    }
    
    // Dollar volume filter
    if (req.query.minDollarVolume) {
      const min = parseFloat(req.query.minDollarVolume);
      filteredStocks = filteredStocks.filter(stock => 
        stock.avgDollarVolume !== null && stock.avgDollarVolume >= min
      );
    }
    
    // Net debt to EBITDA filter
    if (req.query.maxNetDebtToEBITDA) {
      const max = parseFloat(req.query.maxNetDebtToEBITDA);
      filteredStocks = filteredStocks.filter(stock => 
        stock.netDebtToEBITDA !== null && stock.netDebtToEBITDA <= max
      );
    }
    
    // ROTCE filter
    if (req.query.minROTCE) {
      const min = parseFloat(req.query.minROTCE);
      filteredStocks = filteredStocks.filter(stock => 
        stock.rotce !== null && stock.rotce >= min
      );
    }
    
    // FCF to net income filter
    if (req.query.minFCFToNetIncome) {
      const min = parseFloat(req.query.minFCFToNetIncome);
      filteredStocks = filteredStocks.filter(stock => 
        stock.fcfToNetIncome !== null && stock.fcfToNetIncome >= min
      );
    }
    
    // Sort stocks
    filteredStocks.sort((a, b) => {
      const aValue = a[sortField] !== null ? a[sortField] : (sortDirection === 'asc' ? Infinity : -Infinity);
      const bValue = b[sortField] !== null ? b[sortField] : (sortDirection === 'asc' ? Infinity : -Infinity);
      
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    // Paginate stocks
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedStocks = filteredStocks.slice(startIndex, endIndex);
    
    // Return response
    res.json({
      stocks: paginatedStocks,
      total: filteredStocks.length,
      page,
      limit,
      totalPages: Math.ceil(filteredStocks.length / limit)
    });
  } catch (error) {
    console.error('Error getting stocks:', error.message);
    res.status(500).json({ error: 'Error getting stocks' });
  }
});

// Get import status
app.get('/api/import/status', (req, res) => {
  try {
    const importStatus = highSpeedImport.getImportStatus();
    
    // Read batch progress
    let batchProgress = {};
    if (fs.existsSync(BATCH_PROGRESS_FILE)) {
      const batchProgressData = fs.readFileSync(BATCH_PROGRESS_FILE, 'utf8');
      batchProgress = JSON.parse(batchProgressData);
    }
    
    // Read stocks count
    let stocksCount = 0;
    let nyseCount = 0;
    let nasdaqCount = 0;
    
    if (fs.existsSync(ALL_STOCKS_FILE)) {
      const stocksData = fs.readFileSync(ALL_STOCKS_FILE, 'utf8');
      const stocks = JSON.parse(stocksData);
      stocksCount = stocks.length;
      
      // Count NYSE and NASDAQ stocks
      stocks.forEach(stock => {
        if (stock.exchange === 'XNYS') {
          nyseCount++;
        } else if (stock.exchange === 'XNAS') {
          nasdaqCount++;
        }
      });
    }
    
    // Return response
    res.json({
      importStatus,
      batchProgress,
      stocksCount,
      nyseCount,
      nasdaqCount
    });
  } catch (error) {
    console.error('Error getting import status:', error.message);
    res.status(500).json({ error: 'Error getting import status' });
  }
});

// Start import
app.post('/api/import/start', (req, res) => {
  try {
    // Start import in background
    highSpeedImport.importAllStocksHighSpeed()
      .then(() => {
        console.log('Import completed successfully');
      })
      .catch(error => {
        console.error('Error in import process:', error.message);
        errorLogger.logError(error, 'importAllStocksHighSpeed');
      });
    
    res.json({ message: 'Import started' });
  } catch (error) {
    console.error('Error starting import:', error.message);
    res.status(500).json({ error: 'Error starting import' });
  }
});

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start import process automatically
  console.log('Starting import process automatically...');
  highSpeedImport.importAllStocksHighSpeed()
    .then(() => {
      console.log('Import completed successfully');
    })
    .catch(error => {
      console.error('Error in import process:', error.message);
      errorLogger.logError(error, 'importAllStocksHighSpeed');
    });
});
