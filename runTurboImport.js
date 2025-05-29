/**
 * Script to run the turbo import process
 * This launches the high-speed import with maximum throughput
 */

const turboImport = require('./turboImport');

console.log('Starting turbo import process...');
console.log('This will import all NYSE and NASDAQ stocks at maximum speed');
console.log('-------------------------------------------------------------');

// Run the turbo import
turboImport.importAllStocksTurbo()
  .then(() => {
    console.log('Turbo import completed successfully');
  })
  .catch(error => {
    console.error('Error in turbo import:', error.message);
  });
