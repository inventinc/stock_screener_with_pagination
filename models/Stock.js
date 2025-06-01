const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StockSchema = new Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    index: true
  },
  industry: String,
  marketCap: {
    type: Number,
    index: true
  },
  price: Number,
  beta: Number,
  volAvg: {
    type: Number,
    index: true
  },
  lastDiv: Number,
  range: String,
  changes: Number,
  exchange: String,
  description: String,
  website: String,
  ceo: String,
  isEtf: {
    type: Boolean,
    default: false
  },
  // Financial metrics
  financials: {
    debtToEquity: Number,
    debtToEbitda: {
      type: Number,
      index: true
    },
    fcfToNi: {
      type: Number,
      index: true
    },
    evToEbit: {
      type: Number,
      index: true
    },
    rotce: {
      type: Number,
      index: true
    },
    roic: Number,
    peRatio: Number,
    pbRatio: Number,
    dividendYield: Number,
    revenueGrowth: Number,
    grossMargin: Number,
    grossMarginTrend: String, // "improving", "stable", "declining"
    incrementalRoic: Number
  },
  // Qualitative metrics
  qualitative: {
    moatKeywords: {
      count: {
        type: Number,
        default: 0,
        index: true
      },
      keywords: [String]
    },
    insiderOwnership: {
      type: Number,
      index: true
    },
    insiderBuys: {
      type: Number,
      index: true
    },
    redFlags: {
      auditChanges: Boolean,
      managementExits: Boolean,
      hasAnyRedFlags: {
        type: Boolean,
        index: true
      }
    }
  },
  // Ranking scores
  ranking: {
    ownerEarningsYield: {
      type: Number,
      index: true
    },
    rotceScore: {
      type: Number,
      index: true
    },
    combinedScore: {
      type: Number,
      index: true
    },
    previousRanks: [
      {
        date: Date,
        rank: Number
      }
    ]
  },
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create market cap category virtual
StockSchema.virtual('marketCapCategory').get(function() {
  if (this.marketCap >= 10000000000) return 'large';
  if (this.marketCap >= 2000000000) return 'mid';
  if (this.marketCap >= 300000000) return 'small';
  return 'micro';
});

// Create volume category virtual
StockSchema.virtual('volumeCategory').get(function() {
  if (this.volAvg >= 1000000) return 'high';
  if (this.volAvg >= 100000) return 'medium';
  return 'low';
});

// Create debt category virtual
StockSchema.virtual('debtCategory').get(function() {
  if (!this.financials.debtToEquity) return null;
  if (this.financials.debtToEquity < 0.3) return 'low';
  if (this.financials.debtToEquity < 0.6) return 'medium';
  return 'high';
});

// Create valuation category virtual
StockSchema.virtual('valuationCategory').get(function() {
  if (!this.financials.peRatio) return null;
  if (this.financials.peRatio < 15) return 'value';
  if (this.financials.peRatio < 25) return 'blend';
  return 'growth';
});

// Create ROTCE category virtual
StockSchema.virtual('rotceCategory').get(function() {
  if (!this.financials.rotce) return null;
  if (this.financials.rotce > 20) return 'excellent';
  if (this.financials.rotce > 15) return 'good';
  if (this.financials.rotce > 10) return 'average';
  return 'poor';
});

module.exports = mongoose.model('Stock', StockSchema);
