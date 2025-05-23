/**
 * Script to run the adaptive import process
 * This launches the import with dynamic rate limiting
 */

const adaptiveImport = require('./adaptiveImport');

console.log('Starting adaptive import process...');
console.log('This will import all NYSE and NASDAQ stocks with dynamic rate limiting');
console.log('----------------------------------------------------------------');

// Run the adaptive import
adaptiveImport.importAllStocksAdaptive()
  .then(() => {
    console.log('Adaptive import completed successfully');
  })
  .catch(error => {
    console.error('Error in adaptive import:', error.message);
  });
