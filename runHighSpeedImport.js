/**
 * Script to run the high-speed import process
 */

const highSpeedImport = require('./highSpeedImport');

console.log('Starting high-speed import process...');
highSpeedImport.importAllStocksHighSpeed()
  .then(() => {
    console.log('High-speed import process completed successfully');
  })
  .catch(error => {
    console.error('Error in high-speed import process:', error);
    process.exit(1);
  });
