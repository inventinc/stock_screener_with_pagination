# Heroku Deployment Guide for Stock Screener

## Prerequisites
1. Heroku CLI installed on your local machine
2. Git repository initialized
3. MongoDB Atlas database (already configured)

## Step 1: Prepare Your Local Repository

### 1.1 Initialize Git (if not already done)
```bash
git init
git add .
git commit -m "Initial commit"
```

### 1.2 Create .gitignore (if not exists)
```
node_modules/
.env
.DS_Store
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

## Step 2: Heroku Setup

### 2.1 Login to Heroku
```bash
heroku login
```

### 2.2 Create Heroku App
```bash
heroku create your-stock-screener-app-name
```

### 2.3 Set Environment Variables
```bash
heroku config:set MONGODB_URI="mongodb+srv://Google:wsPxmtMoNpQ4OfUI@cluster0.cclapno.mongodb.net/stock-screener?retryWrites=true&w=majority&appName=Cluster0"
heroku config:set FMP_API_KEY="nVR1WhOPm2A0hL8yjk8sVahVjiw9TB5l"
```

## Step 3: Deploy to Heroku

### 3.1 Deploy
```bash
git push heroku main
```

### 3.2 Open Your App
```bash
heroku open
```

## Step 4: Monitor and Debug

### 4.1 View Logs
```bash
heroku logs --tail
```

### 4.2 Check App Status
```bash
heroku ps
```

## Configuration Details

### Files Already Configured:
- ✅ `Procfile` - Tells Heroku how to run your app
- ✅ `package.json` - Contains start script and dependencies
- ✅ `server.js` - Updated to use `process.env.PORT`
- ✅ `.env` - Updated with MongoDB Atlas connection

### Environment Variables Set:
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `FMP_API_KEY` - Your Financial Modeling Prep API key
- `PORT` - Automatically set by Heroku

## Important Notes:

1. **Database Name**: The connection string includes `/stock-screener` as the database name
2. **Security**: Never commit your `.env` file to Git
3. **Scaling**: Your app will start with 1 free dyno
4. **SSL**: Heroku automatically provides HTTPS
5. **Domain**: Your app will be available at `https://your-app-name.herokuapp.com`

## Troubleshooting:

### If deployment fails:
1. Check logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Ensure all dependencies are in `package.json`
4. Check that `engines` field in `package.json` matches your Node version

### If MongoDB connection fails:
1. Verify the connection string is correct
2. Check MongoDB Atlas network access settings
3. Ensure the database user has proper permissions

## Post-Deployment:

1. Test all functionality on the live site
2. Monitor performance and logs
3. Set up any additional monitoring or alerts as needed

