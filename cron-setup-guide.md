# Setting Up Daily Stock Data Refresh

This guide provides detailed instructions for setting up daily stock data refresh on various hosting platforms.

## Option 1: Render.com Cron Jobs

Render.com provides built-in support for scheduled jobs:

1. **Create a new Cron Job service**:
   - From your Render dashboard, click "New" and select "Cron Job"
   - Connect to your repository or use the same source as your web service

2. **Configure the job**:
   - **Name**: `stock-data-refresh`
   - **Schedule**: `30 17 * * 1-5` (runs at 5:30 PM ET on weekdays)
   - **Command**: `node refresh_stock_data.js`
   - **Environment**: Node.js
   - **Environment Variables**: Same as your web service (including MONGODB_URI)

3. **Deploy the job**:
   - Click "Create Cron Job"
   - Render will automatically run it according to the schedule

## Option 2: Heroku Scheduler

If you're using Heroku:

1. **Install the Scheduler add-on**:
   ```
   heroku addons:create scheduler:standard
   ```

2. **Configure the job**:
   - Open the Scheduler dashboard: `heroku addons:open scheduler`
   - Click "Add Job"
   - Command: `node refresh_stock_data.js`
   - Schedule: Daily at your preferred time (after market close)
   - Save the job

## Option 3: Manual Setup with Linux Cron

If you're using a VPS or dedicated server:

1. **Open the crontab editor**:
   ```
   crontab -e
   ```

2. **Add the cron job**:
   ```
   # Run stock data refresh at 5:30 PM ET on weekdays
   30 17 * * 1-5 cd /path/to/your/app && node refresh_stock_data.js >> /path/to/your/app/logs/cron.log 2>&1
   ```

3. **Save and exit**:
   - The cron daemon will automatically pick up the new job

## Option 4: GitHub Actions

For a serverless approach:

1. **Create a workflow file** in your repository at `.github/workflows/refresh-stocks.yml`:
   ```yaml
   name: Daily Stock Refresh

   on:
     schedule:
       # Run at 5:30 PM ET (21:30 UTC) on weekdays
       - cron: '30 21 * * 1-5'

   jobs:
     refresh:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
           with:
             node-version: '16'
         - run: npm install
         - run: node refresh_stock_data.js
         env:
           MONGODB_URI: ${{ secrets.MONGODB_URI }}
           FMP_API_KEY: ${{ secrets.FMP_API_KEY }}
   ```

2. **Add repository secrets**:
   - Go to your repository settings
   - Add MONGODB_URI and FMP_API_KEY as secrets

## Monitoring and Troubleshooting

- Check the `logs/refresh_log.txt` file for refresh history and errors
- Set up email notifications for failed jobs (platform-specific)
- Consider implementing a backup refresh mechanism for reliability

## Best Practices

- Schedule the refresh after market close (4:00 PM ET) to get final daily data
- Allow enough time between refresh attempts (at least 24 hours)
- Monitor API usage to stay within your plan limits
- Periodically check data quality using the validation script
