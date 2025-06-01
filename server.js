require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Import routes
const stockRoutes = require('./routes/stocks');
const filterRoutes = require('./routes/filters');

// Create Express app
const app = express();

// Set port
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());

// API Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/filters', filterRoutes);

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes not handled by API
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-screener', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
