# Deploying Stock Screener to Render.com

This guide provides step-by-step instructions for deploying the Stock Screener application to Render.com for permanent hosting.

## Prerequisites

1. A Render.com account (free tier available)
2. Your MongoDB connection string
3. The stock screener application files (provided in the zip)

## Deployment Steps

### 1. Create a Render Account

1. Go to [Render.com](https://render.com/) and sign up for an account
2. Verify your email address and log in

### 2. Create a New Web Service

1. From your Render dashboard, click "New" and select "Web Service"
2. Connect your GitHub repository or select "Deploy from existing repository"
   - If you don't have a GitHub repository, you can use the "Upload Files" option

### 3. Configure Your Web Service

Enter the following configuration:
- **Name**: `stock-screener` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose the region closest to your users
- **Branch**: `main` (or your default branch)
- **Build Command**: `npm install`
- **Start Command**: `node optimized_server.js`
- **Plan**: Free (or select a paid plan for better performance)

### 4. Set Environment Variables

Add the following environment variables:
- `MONGODB_URI`: Your MongoDB connection string
- `PORT`: `8080` (Render uses this port by default)
- `NODE_ENV`: `production`

### 5. Deploy Your Application

1. Click "Create Web Service"
2. Wait for the deployment to complete (this may take a few minutes)
3. Once deployed, Render will provide a URL for your application (e.g., `https://stock-screener.onrender.com`)

### 6. Verify Your Deployment

1. Visit the provided URL to ensure your application is running correctly
2. Test the stock data loading and filtering functionality
3. Check that the API endpoints are working properly

### 7. Custom Domain (Optional)

To use your own domain:
1. Go to your web service settings
2. Click on "Custom Domain"
3. Follow the instructions to add and verify your domain

## Troubleshooting

If you encounter issues:

1. **Application not loading**: Check the Render logs for errors
2. **Database connection issues**: Verify your MongoDB connection string
3. **Missing data**: Ensure your database is properly populated with stock data

## Maintenance

To update your application:
1. Push changes to your connected repository
2. Render will automatically rebuild and deploy the updated version

## Scaling (Future Considerations)

As your usage grows:
1. Consider upgrading to a paid plan for better performance
2. Implement database indexing for faster queries
3. Add caching mechanisms for frequently accessed data

For additional support, refer to the [Render documentation](https://render.com/docs) or contact their support team.
