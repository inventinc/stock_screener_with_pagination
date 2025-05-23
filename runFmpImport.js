/**
 * Script to run the FMP import process
 * This launches the import with dynamic rate limiting
 */
const fmpImport = require('./fmpImport');

console.log('Starting Financial Modeling Prep import process...');
console.log('This will import all NYSE and NASDAQ stocks with dynamic rate limiting');
console.log('----------------------------------------------------------------');

// Run the FMP import
fmpImport.importAllStocksAdaptive()
  .then(() => {
    console.log('FMP import completed successfully');
  })
  .catch(error => {
    console.error('Error in FMP import:', error.message);
  });
