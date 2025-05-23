/**
 * MongoDB configuration for the stock screener application
 * Provides configuration options for different environments
 */
// Configuration for different environments
const config = {
  development: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB',
    options: {
      maxPoolSize: 10
    }
  },
  test: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksDB_test',
    options: {
      maxPoolSize: 5
    }
  },
  production: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://manus31:WdRG6pVbspSso8EH@cluster0.cclapno.mongodb.net/stockscreener_prod?retryWrites=true&w=majority',
    options: {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  }
};

// Get current environment
const env = process.env.NODE_ENV || 'development';

// Export configuration based on environment
module.exports = {
  getConfig: async () => {
    console.log(`Using ${env} environment configuration`);
    console.log(`MongoDB URI: ${config[env].uri.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:****@')}`);
    return config[env];
  }
};
