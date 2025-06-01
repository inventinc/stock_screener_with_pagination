const schedule = require('node-schedule');
const { fetchAndSaveStocks } = require('./fetchStocksBackground');

console.log('Scheduler starting...');

// Schedule the job to run once every day at a specific time (e.g., 3:00 AM)
// The cron pattern '0 3 * * *' means:
// 0: Minute (0)
// 3: Hour (3)
// *: Day of the month (every day)
// *: Month (every month)
// *: Day of the week (every day of the week)
const job = schedule.scheduleJob('0 3 * * *', async function() {
    console.log('Running scheduled job: fetchAndSaveStocks');
    try {
        await fetchAndSaveStocks();
        console.log('Scheduled job finished successfully.');
    } catch (error) {
        console.error('Error running scheduled job:', error);
    }
});

console.log('fetchAndSaveStocks job scheduled to run once every day at 3:00 AM.');

// Optional: Listen for the 'scheduled' event
job.on('scheduled', function(startTime){
  console.log('Job successfully scheduled to run at ' + startTime);
});

// Optional: Listen for the 'error' event on the job itself
job.on('error', function(err){
  console.error('Job encountered an error:', err);
});

// To keep the scheduler running, you need to keep the Node.js process alive.
// If this script is run as a standalone process, it will naturally stay alive
// due to the scheduled job. If you integrate this into your Express server,
// ensure your server process stays running.