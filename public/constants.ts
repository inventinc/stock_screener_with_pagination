import { KeyMetricVisibility, DisplayMetricConfig, FilterGroupDef, Preset } from './types';

export const STOCKS_PER_PAGE = 15;
export const INITIAL_STOCK_LOAD_COUNT = 1000; // Increased from 250

export const INITIAL_KEY_METRICS_VISIBILITY: KeyMetricVisibility = {
  stocksPassingFilters: true,
  avgDebtEbitda: true,
  avgEvEbit: true,
  avgFcfNi: true,
  avgRotce: true, // ROE proxy
  price: true,
  simpleScore: true, // Added
  debtEbitdaIndividual: true,
  evEbitIndividual: true,
  fcfNiIndividual: true,
  rotceIndividual: true, // ROE proxy
};

export const DISPLAY_METRICS_CONFIG: DisplayMetricConfig[] = [
  { id: 'stocksPassingFilters', label: 'Stocks Passing', type: 'summary' },
  { id: 'avgDebtEbitda', label: 'Avg. Debt/EBITDA', type: 'summary' },
  { id: 'avgEvEbit', label: 'Avg. EV/EBITDA', type: 'summary' }, // Note: FMP provides EV/EBITDA
  { id: 'avgFcfNi', label: 'Avg. FCF/NI', type: 'summary' },
  { id: 'avgRotce', label: 'Avg. ROE', type: 'summary' },
  
  { id: 'symbol', label: 'Symbol', type: 'individual', dataKey: 'symbol', alwaysVisible: true },
  { id: 'name', label: 'Name', type: 'individual', dataKey: 'name', alwaysVisible: true },
  { id: 'sector', label: 'Sector', type: 'individual', dataKey: 'sector', alwaysVisible: true },
  { id: 'price', label: 'Price', type: 'individual', dataKey: 'price', alwaysVisible: false, formatter: (val) => val ? `$${Number(val).toFixed(2)}` : 'N/A'},
  { id: 'simpleScore', label: 'Score', type: 'individual', dataKey: 'simpleScore', alwaysVisible: false }, // Added
  { id: 'debtEbitdaIndividual', label: 'Debt/EBITDA', type: 'individual', dataKey: 'debtEbitda', alwaysVisible: false },
  { id: 'evEbitIndividual', label: 'EV/EBITDA', type: 'individual', dataKey: 'evEbit', alwaysVisible: false }, // Note: FMP provides EV/EBITDA
  { id: 'fcfNiIndividual', label: 'FCF/NI', type: 'individual', dataKey: 'fcfNi', alwaysVisible: false },
  { id: 'rotceIndividual', label: 'ROE', type: 'individual', dataKey: 'rotce', alwaysVisible: false }, // Using ROE as proxy
];

export const STOCK_DATA_BASE = [ /* Fallback data, not primary */ ];

export const FILTER_GROUPS: FilterGroupDef[] = [
  {
    id: 'companySizeAndLiquidity', title: 'Company Size & Liquidity', emoji: '🏢',
    subGroups: [
      { 
        id: 'marketCap', 
        title: 'Market Cap', 
        tooltip: "Market capitalization. Median 30-day dollar volume can be seen in stock details.", 
        options: [
          {value: 'nano', label: 'Nano Cap (< $50M)'},
          {value: 'micro', label: 'Micro Cap ($50M-$300M)'}, 
          {value: 'small', label: 'Small Cap ($300M-$2B)'}, 
          {value: 'midLarge', label: 'Mid/Large Cap (> $2B)'} // Combined Mid/Large
        ]
      },
      { 
        id: 'volume', 
        title: 'Avg. Daily Volume', 
        tooltip: "Average number of shares traded per day.", 
        options: [
          {value: 'high', label: 'High Vol (>1M)'}, 
          {value: 'medium', label: 'Med Vol (100k-1M)'}, 
          {value: 'low', label: 'Low Vol (<100k)'}
        ]
      },
      {
        id: 'liquiditySafety', title: 'Liquidity Safety (Days to Exit 5%)',
        tooltip: 'Max days to exit a 5% position at $100k Average Daily Value. Placeholder.',
        controlType: 'slider', sliderMin: 1, sliderMax: 10, sliderStep: 1, sliderDefault: 5,
        options: [] // Options not used for slider type directly here for buttons
      }
    ]
  },
  {
    id: 'capitalStructure', title: 'Capital Structure', emoji: '🏗️',
    tooltip: "How a company finances its overall operations and growth.",
    subGroups: [
      { 
        id: 'debtEquityRatio', // Changed from 'debt'
        title: 'Debt/Equity Ratio', 
        tooltip: "Compares total liabilities to shareholder equity.", 
        options: [
          {value: 'low', label: 'Low D/E (<0.5)'}, 
          {value: 'medium', label: 'Med D/E (0.5-1)'}, 
          {value: 'high', label: 'High D/E (>1)'}
        ]
      },
      { 
        id: 'debtToEbitda', 
        title: 'Debt/EBITDA', 
        tooltip: "Company's ability to pay off debt. Lower is often better.", 
        options: [{value: 'le1x', label: '≤ 1x'}, {value: 'le0.5x', label: '≤ 0.5x'}, {value: 'le0.25x', label: '≤ 0.25x'}]
      },
    ]
  },
  {
    id: 'profitability', title: 'Profitability', emoji: '💰',
    tooltip: "Company's ability to generate profit relative to its revenue, assets, equity.",
    subGroups: [
       { 
        id: 'roe', // Changed from 'rotce' as we use ROE as proxy
        title: 'Return on Equity (ROE)', 
        tooltip: "Profitability relative to shareholder equity. Net Income / Shareholder's Equity.", 
        options: [
          {value: 'excellent', label: 'Excellent (>20%)'}, 
          {value: 'good', label: 'Good (15-20%)'}, 
          {value: 'average', label: 'Average (10-15%)'}, 
          {value: 'poor', label: 'Poor (<10%)'}
        ]
      },
      { 
        id: 'fcfToNetIncome', // Changed from 'fcfNiRatio'
        title: 'FCF/Net Income Ratio', 
        tooltip: "Free Cash Flow to Net Income. Ratio > 1 can indicate high earnings quality.", 
        options: [{value: 'ge0.8', label: '≥ 0.8'}, {value: 'ge1.0', label: '≥ 1.0'}, {value: 'ge1.2', label: '≥ 1.2'}]
      },
      { 
        id: 'gmTrend', // Changed from 'grossMarginTrend'
        title: 'Gross Margin Trend', 
        tooltip: "Direction of gross profit margin. (Placeholder - data not live)", 
        options: [{value: 'improving', label: 'Improving'}, {value: 'stable', label: 'Stable'}, {value: 'any', label: 'Any'}]
      },
    ]
  },
  {
    id: 'capitalDiscipline', title: 'Capital Discipline', emoji: '⚖️',
    tooltip: "How well a company manages its investments and capital allocation.",
    subGroups: [
      { 
        id: 'incRoic', // Changed from 'incrementalRoic'
        title: 'Incremental ROIC', 
        tooltip: "Return on new capital invested. (Placeholder - data not live)", 
        options: [{value: 'ge15pct', label: '≥ 15%'}, {value: 'ge20pct', label: '≥ 20%'}, {value: 'ge25pct', label: '≥ 25%'}]},
      { 
        id: 'shareCountChange', // Changed from 'shareCountCagr'
        title: 'Share Count Change (CAGR)', 
        tooltip: "Growth rate of shares outstanding. Negative (buybacks) often positive. (Placeholder - data not live)", 
        options: [{value: 'le0pct', label: '≤ 0%'}, {value: 'le-2pct', label: '≤ -2%'}, {value: 'le-5pct', label: '≤ -5%'}]},
    ]
  },
  {
    id: 'valuation', title: 'Valuation', emoji: '💎',
    tooltip: "Metrics to assess if a stock is under or overvalued.",
    subGroups: [
       { 
        id: 'peRatio', // Changed from 'valuation'
        title: 'Price/Earnings (P/E) Ratio', 
        tooltip: "Stock price relative to earnings per share.", 
        options: [
          {value: 'value', label: 'Value (<15 P/E)'}, 
          {value: 'growth', label: 'Growth (>25 P/E)'}, 
          {value: 'blend', label: 'Blend (15-25 P/E)'}
        ]
      },
      { 
        id: 'evToEbit', // Changed from 'evEbit' (Note: FMP gives EV/EBITDA)
        title: 'EV/EBITDA', 
        tooltip: "Enterprise Value to EBITDA. Lower values often preferred. (Using FMP's EV/EBITDA)", 
        options: [{value: 'le10x', label: '≤ 10x'}, {value: 'le8x', label: '≤ 8x'}, {value: 'le6x', label: '≤ 6x'}]
      },
      { 
        id: 'priceToNCAV', // Changed from 'deepValue'
        title: 'Price/Net Current Asset Value (P/NCAV)', 
        tooltip: "P/NCAV < 1 may indicate deep value. (Placeholder - data not live)", 
        options: [{value: 'le0.66', label: 'P/NCAV ≤ 0.66'}]
      },
    ]
  },
  {
    id: 'ownershipGovernance', title: 'Ownership & Governance', emoji: '👥',
    tooltip: "Factors related to company ownership, insider activity, and governance.",
    subGroups: [
       { 
        id: 'insiderOwn', // Changed from 'insiderOwnership'
        title: 'Insider Ownership %', 
        tooltip: "Stock held by officers, directors. (Placeholder - data not live)", 
        options: [{value: 'ge8pct', label: '≥ 8%'}, {value: 'ge15pct', label: '≥ 15%'}, {value: 'ge25pct', label: '≥ 25%'}]},
      { 
        id: 'netInsiderTrx', // Changed from 'netInsiderBuys'
        title: 'Net Insider Buys', 
        tooltip: "Net shares bought by insiders. (Placeholder - data not live)", 
        options: [{value: 'any', label: 'Any'}, {value: 'ge3', label: '≥ 3 Tx'}, {value: 'ge5', label: '≥ 5 Tx'}]},
      { 
        id: 'rdFlags', // Changed from 'redFlags'
        title: 'Exclude Red Flags', 
        tooltip: "Auditor changes, management exits. (Placeholder - data not live)", 
        options: [{value: 'auditChanges', label: 'Audit Changes'}, {value: 'managementExits', label: 'Mgmt Exits'}, {value: 'allRedFlags', label: 'All Red Flags'}]},
    ]
  },
  {
    id: 'qualitativeAndCatalysts', title: 'Qualitative & Catalysts', emoji: '✨',
    tooltip: "Qualitative aspects and potential event-driven catalysts. (Placeholders - data not live)",
    subGroups: [
      { 
        id: 'moatKws', // Changed from 'moatKeywords'
        title: 'Moat Keywords', 
        tooltip: "Keywords in reports (e.g., 'competitive advantage').", 
        options: [{value: 'ge3', label: '≥ 3 hits'}, {value: 'ge5', label: '≥ 5 hits'}, {value: 'ge10', label: '≥ 10 hits'}]
      },
    ],
    // Example for top-level options for a group (like catalysts)
    options: [ 
        {value: 'spinOff', label: 'Spin-off (Catalyst)'},
        {value: 'selfTender', label: 'Self-tender (Catalyst)'},
    ],
    controlType: 'checkboxes' // Indicate these should be checkboxes if rendered directly
  }
];

export const PRESETS: Preset[] = [
  { 
    id: 'deepValue', 
    name: "Deep Value", 
    emoji: '🛡️', 
    description: "Low P/E, potentially smaller cap stocks.", 
    filters: { marketCap: 'small', peRatio: 'value', debtToEbitda: 'le1x' } // Updated filter keys
  },
  { 
    id: 'qualityCompounders', 
    name: "Quality Compounders", 
    emoji: '🌱', 
    description: "High ROE, reasonable debt.", 
    filters: { roe: 'excellent', debtEquityRatio: 'medium', marketCap: 'midLarge' } // Updated filter keys
  },
  { 
    id: 'eventDriven', 
    name: "Event-Driven (Concept)", 
    emoji: '⚡', 
    description: "Placeholder for event-driven strategies (e.g., spin-offs). Currently uses broad filters.", 
    filters: { volume: 'high' } // Placeholder
  },
];