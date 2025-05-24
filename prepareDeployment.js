/**
 * Deployment script for the unified stock screener application
 * This script prepares and deploys the backend and frontend together
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const sourceDir = '/home/ubuntu/real_data_backend';
const deployDir = '/home/ubuntu/deploy_stock_screener';

// Create deployment directory
console.log('Creating deployment directory...');
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// Copy backend files
console.log('Copying backend files...');
const backendFiles = [
  'productionServer.js',
  'scoreCalculator.js',
  'adaptiveImport.js',
  'errorLogger.js',
  'package.production.json'
];

backendFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(deployDir, file === 'package.production.json' ? 'package.json' : file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file}`);
  } else {
    console.error(`Error: ${file} not found`);
  }
});

// Copy data directory
console.log('Copying data directory...');
const dataDir = path.join(sourceDir, 'data');
const deployDataDir = path.join(deployDir, 'data');

if (!fs.existsSync(deployDataDir)) {
  fs.mkdirSync(deployDataDir, { recursive: true });
}

if (fs.existsSync(dataDir)) {
  const dataFiles = fs.readdirSync(dataDir);
  dataFiles.forEach(file => {
    const sourcePath = path.join(dataDir, file);
    const destPath = path.join(deployDataDir, file);
    
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied data/${file}`);
    }
  });
} else {
  console.error('Error: data directory not found');
}

// Create client build directory
console.log('Creating client build directory...');
const clientBuildDir = path.join(deployDir, 'client', 'build');
if (!fs.existsSync(clientBuildDir)) {
  fs.mkdirSync(clientBuildDir, { recursive: true });
}

// Copy frontend build files
console.log('Copying frontend build files...');
const clientBuildSourceDir = path.join(sourceDir, 'client', 'build');
if (fs.existsSync(clientBuildSourceDir)) {
  const buildFiles = fs.readdirSync(clientBuildSourceDir);
  buildFiles.forEach(file => {
    const sourcePath = path.join(clientBuildSourceDir, file);
    const destPath = path.join(clientBuildDir, file);
    
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied client/build/${file}`);
    } else if (fs.statSync(sourcePath).isDirectory()) {
      // Copy directory recursively
      execSync(`cp -r "${sourcePath}" "${path.join(clientBuildDir, '..')}"`);
      console.log(`Copied directory client/build/${file}`);
    }
  });
} else {
  console.error('Error: client build directory not found');
  
  // Create a simple index.html for testing
  const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Screener</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      background-color: #e8f4f8;
      border-radius: 5px;
    }
    .stocks {
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f2f2f2;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stock Screener</h1>
    <div class="status" id="status">
      Loading status...
    </div>
    <div class="stocks" id="stocks">
      <h2>Stocks</h2>
      <table id="stocksTable">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th>Exchange</th>
            <th>Price</th>
            <th>Market Cap</th>
          </tr>
        </thead>
        <tbody id="stocksBody">
          <tr>
            <td colspan="5">Loading stocks...</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    // Fetch stocks from API
    async function fetchStocks() {
      try {
        const response = await fetch('/api/stocks');
        const data = await response.json();
        
        // Update status
        document.getElementById('status').innerHTML = \`
          <p>Total Stocks: \${data.stats.total}</p>
          <p>NYSE: \${data.stats.nyse}</p>
          <p>NASDAQ: \${data.stats.nasdaq}</p>
          <p>Last Updated: \${new Date(data.stats.lastUpdated).toLocaleString()}</p>
        \`;
        
        // Update stocks table
        const stocksBody = document.getElementById('stocksBody');
        if (data.stocks.length === 0) {
          stocksBody.innerHTML = '<tr><td colspan="5">No stocks found</td></tr>';
        } else {
          stocksBody.innerHTML = data.stocks.map(stock => \`
            <tr>
              <td>\${stock.symbol}</td>
              <td>\${stock.name}</td>
              <td>\${stock.exchange}</td>
              <td>\${stock.price ? '$' + stock.price.toFixed(2) : 'N/A'}</td>
              <td>\${stock.marketCap ? formatMarketCap(stock.marketCap) : 'N/A'}</td>
            </tr>
          \`).join('');
        }
      } catch (error) {
        console.error('Error fetching stocks:', error);
        document.getElementById('status').innerHTML = '<p>Error fetching stocks. Please try again later.</p>';
        document.getElementById('stocksBody').innerHTML = '<tr><td colspan="5">Failed to load stocks</td></tr>';
      }
    }
    
    // Format market cap
    function formatMarketCap(marketCap) {
      if (marketCap >= 1e12) {
        return '$' + (marketCap / 1e12).toFixed(1) + 'T';
      } else if (marketCap >= 1e9) {
        return '$' + (marketCap / 1e9).toFixed(1) + 'B';
      } else if (marketCap >= 1e6) {
        return '$' + (marketCap / 1e6).toFixed(1) + 'M';
      } else {
        return '$' + marketCap.toFixed(0);
      }
    }
    
    // Fetch stocks on page load
    fetchStocks();
    
    // Refresh every 30 seconds
    setInterval(fetchStocks, 30000);
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(clientBuildDir, 'index.html'), indexHtml);
  console.log('Created simple index.html for testing');
}

console.log('Deployment preparation completed!');
console.log(`Files are ready in ${deployDir}`);
console.log('To deploy, run: cd ' + deployDir + ' && npm install && npm start');
