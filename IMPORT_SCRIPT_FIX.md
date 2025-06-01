# P-Queue Import Script Fix

## 🚨 **Error:** `TypeError: Queue is not a constructor`

This is the same p-queue ES module compatibility issue. Your Heroku deployment still has the old version.

## 🚀 **Quick Fix Options:**

### **Option 1: Deploy Updated Package (Recommended)**

The issue is that your Heroku deployment doesn't have the p-queue fix we applied. You need to redeploy:

```bash
# In your local project directory with the fixed package.json:
git add .
git commit -m "Fix p-queue version for import script"
git push heroku main

# Then run the import script:
heroku run node fetchStocksBackground.js --app stockscreener2
```

### **Option 2: Alternative Import Without p-queue**

Create a simpler version that doesn't use p-queue:

```bash
# Run this alternative command instead:
heroku run node -e "
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function quickImport() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  // Simple import without queue - just get first 100 stocks
  const response = await axios.get(\`https://financialmodelingprep.com/api/v3/stock-screener?marketCapMoreThan=1000000000&limit=100&apikey=\${process.env.FMP_API_KEY}\`);
  
  console.log(\`Got \${response.data.length} stocks\`);
  
  for (const stock of response.data.slice(0, 10)) {
    console.log(\`Processing \${stock.symbol}\`);
    // Add basic categories
    stock.marketCapCategory = stock.marketCap > 2000000000 ? 'midLarge' : 'small';
    stock.volumeCategory = stock.volume > 1000000 ? 'high' : 'low';
    stock.debtCategory = 'low'; // Default for now
    stock.valuationCategory = stock.pe > 25 ? 'growth' : 'value';
    stock.rotceCategory = 'good'; // Default for now
    
    // Save to MongoDB (simplified)
    await mongoose.connection.collection('stocks').updateOne(
      { symbol: stock.symbol },
      { \$set: stock },
      { upsert: true }
    );
  }
  
  console.log('Import completed!');
  process.exit(0);
}

quickImport().catch(console.error);
" --app stockscreener2
```

### **Option 3: Manual Category Addition**

Add categories directly via MongoDB:

```bash
heroku run node -e "
const mongoose = require('mongoose');
require('dotenv').config();

async function addCategories() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Add categories to existing stocks
  await mongoose.connection.collection('stocks').updateMany(
    { marketCap: { \$gt: 2000000000 } },
    { \$set: { marketCapCategory: 'midLarge' } }
  );
  
  await mongoose.connection.collection('stocks').updateMany(
    { marketCap: { \$lt: 2000000000 } },
    { \$set: { marketCapCategory: 'small' } }
  );
  
  await mongoose.connection.collection('stocks').updateMany(
    { volAvg: { \$gt: 1000000 } },
    { \$set: { volumeCategory: 'high' } }
  );
  
  await mongoose.connection.collection('stocks').updateMany(
    { volAvg: { \$lt: 1000000 } },
    { \$set: { volumeCategory: 'low' } }
  );
  
  // Add default categories for other fields
  await mongoose.connection.collection('stocks').updateMany(
    {},
    { 
      \$set: { 
        debtCategory: 'low',
        valuationCategory: 'growth', 
        rotceCategory: 'good'
      } 
    }
  );
  
  console.log('Categories added to all stocks!');
  process.exit(0);
}

addCategories().catch(console.error);
" --app stockscreener2
```

## 🎯 **Recommended Approach:**

**Try Option 3 first** - it's the fastest and will immediately fix your filters by adding categories to your existing data.

After running Option 3, test your filters at:
https://stockscreener2-43e0f16c02cf.herokuapp.com/

Which option would you like to try?

