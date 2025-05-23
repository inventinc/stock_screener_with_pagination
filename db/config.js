/**
 * MongoDB configuration for the stock screener application
 * Provides configuration options for different environments
 */

// Configuration for different environments
const config = {
  development: {
    uri: 'mongodb+srv://manus31:WdRG6pVbspSso8EH@cluster0.cclapno.mongodb.net/stockscreener?retryWrites=true&w=majority',
    options: {
      maxPoolSize: 10
    }
  },
  test: {
    uri: 'mongodb+srv://manus31:WdRG6pVbspSso8EH@cluster0.cclapno.mongodb.net/stockscreener_test?retryWrites=true&w=majority',
    options: {
      maxPoolSize: 5
    }
  },
  production: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://manus31:WdRG6pVbspSso8EH@cluster0.cclapno.mongodb.net/stockscreener_prod?retryWrites=true&w=majority',
    options: {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  }
};

// Get current environment
const env = process.env.NODE_ENV || 'development';

// Export configuration based on environment
module.exports = {
  getConfig: async () => {
    return config[env];
  }
};
