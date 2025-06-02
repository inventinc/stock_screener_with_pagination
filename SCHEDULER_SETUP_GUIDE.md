# Scheduler Setup Guide - Automatic Daily Updates

## 🤔 How Automatic Scheduling Works

The scheduler **does NOT run automatically by default**. You need to explicitly enable it. Here's how it works:

## 📋 Current Scheduler Configuration

The `scheduler.js` file is configured to:
- Run every day at **3:00 AM** (server time)
- Use cron pattern `'0 3 * * *'`
- Execute the `fetchStocksBackground.js` import script
- Update your MongoDB with fresh stock data

## 🚀 3 Ways to Enable Automatic Updates

### Option 1: Separate Heroku Dyno (Recommended)
Add a worker dyno to your Heroku app:

```bash
# Update your Procfile to include:
echo "worker: node scheduler.js" >> Procfile

# Deploy the change
git add Procfile
git commit -m "Add scheduler worker"
git push heroku main

# Scale up the worker dyno
heroku ps:scale worker=1
```

**Cost:** ~$7/month for hobby dyno
**Benefit:** Dedicated process, reliable scheduling

### Option 2: Integrate with Main Server (Free)
Modify your `server.js` to include the scheduler:

```javascript
// Add this line at the top of server.js after other requires
require('./scheduler');
```

**Cost:** Free (uses existing web dyno)
**Limitation:** Heroku web dynos sleep after 30 minutes of inactivity

### Option 3: External Cron Service (Free)
Use a service like GitHub Actions or external cron to trigger updates:

```bash
# Create an endpoint in your server.js for manual triggers
app.post('/api/update-stocks', async (req, res) => {
  try {
    const { fetchAndSaveStocks } = require('./fetchStocksBackground');
    await fetchAndSaveStocks();
    res.json({ success: true, message: 'Stock data updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

Then use GitHub Actions or similar to call this endpoint daily.

## 🔧 Implementation Steps

### For Option 1 (Recommended):

1. **Update Procfile:**
```
web: node server.js
worker: node scheduler.js
```

2. **Deploy and Scale:**
```bash
git add Procfile
git commit -m "Add scheduler worker"
git push heroku main
heroku ps:scale worker=1
```

3. **Monitor:**
```bash
heroku logs --tail --dyno=worker
```

### For Option 2 (Free but Limited):

1. **Modify server.js:**
Add `require('./scheduler');` after line 1

2. **Deploy:**
```bash
git add server.js
git commit -m "Integrate scheduler with main server"
git push heroku main
```

**Note:** This only works if your app gets regular traffic to prevent sleeping.

## 📊 Scheduler Status Check

### Verify Scheduler is Running:
```bash
# Check if worker dyno is running (Option 1)
heroku ps

# Check logs for scheduler messages
heroku logs --grep="Scheduler starting"
```

### Manual Trigger (Testing):
```bash
# Run import manually to test
heroku run node fetchStocksBackground.js
```

## ⏰ Scheduling Details

### Current Schedule:
- **Time:** 3:00 AM (server timezone - UTC)
- **Frequency:** Daily
- **Duration:** ~5-7 minutes for full import
- **Data Updated:** All stock metrics, prices, ratios

### Customize Schedule:
Edit `scheduler.js` line 8:
```javascript
// Current: '0 3 * * *' (3:00 AM daily)
// Every 6 hours: '0 */6 * * *'
// Twice daily: '0 3,15 * * *' (3 AM and 3 PM)
// Weekdays only: '0 3 * * 1-5'
```

## 🎯 Recommendation

**For Production:** Use Option 1 (separate worker dyno)
- Most reliable
- Dedicated resources
- Better error handling
- Worth the $7/month cost

**For Development/Testing:** Use Option 2 (integrated)
- Free
- Good for low-traffic apps
- May miss updates if app sleeps

## 🔍 Monitoring & Troubleshooting

### Check if Scheduler is Working:
1. **Logs:** `heroku logs --tail --grep="Scheduler"`
2. **Database:** Check `lastUpdated` field in MongoDB
3. **Manual Test:** `heroku run node scheduler.js` (will run once immediately)

### Common Issues:
- **Dyno Sleeping:** Use Option 1 or keep app active
- **Timezone Confusion:** Heroku uses UTC time
- **Memory Limits:** Import process uses ~200MB RAM
- **API Rate Limits:** Built-in rate limiting handles this

Your scheduler is ready to go - you just need to choose how to activate it! 🚀

