
export interface HistoricalPricePoint {
  date: string;
  close: number;
}

export interface HistoricalFinancialDataPoint {
  year: number;
  fiscalDateEnding: string;
  reportedCurrency?: string;
  commonStockSharesOutstanding?: number | null;
  netIncome?: number | null;
  totalStockholdersEquity?: number | null;
  goodwill?: number | null;
  intangibleAssets?: number | null;
  calculatedROTCE?: number | null;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  companyName: string; // Company name from API
  sector: string;
  price: number; 
  simpleScore?: number; // New simplified score

  // Raw values from API
  marketCap?: number;
  avgVolume?: number;
  peRatioTTM?: number | null;
  priceEarningsRatioTTM?: number | null; // P/E ratio from API
  debtEquityRatioTTM?: number | null;
  returnOnEquityTTM?: number | null; // Used as ROTCE proxy
  debtToEbitdaTTM?: number | null;
  enterpriseValueOverEBITDATTM?: number | null; 
  freeCashFlowPerShareTTM?: number | null;
  netIncomePerShareTTM?: number | null;
  
  // Categorical and formatted string values
  debtEbitda: string; 
  evEbit: string; 
  fcfNi: string; 
  rotce: string; 

  marketCapCategory: 'nano' | 'micro' | 'small' | 'mid' | 'large' | string; // Added 'nano'
  volumeCategory: 'low' | 'medium' | 'high' | string;
  debtCategory: 'low' | 'medium' | 'high' | string; // Based on Debt/Equity
  valuationCategory: 'value' | 'growth' | 'blend' | string; // Based on P/E
  rotceCategory: 'poor' | 'average' | 'good' | 'excellent' | string; // Based on ROE
  
  styleTags?: StyleTag[]; // New for visual tags

  // Placeholders for more complex filters, often "N/A" from FMP for list view
  numericDebtEbitdaCategory: 'le0.25x' | 'le0.5x' | 'le1x' | string;
  numericFcfNiCategory: 'ge0.8' | 'ge1.0' | 'ge1.2' | string;
  shareCountCagrCategory: 'le0pct' | 'le-2pct' | 'le-5pct' | string;
  numericEvEbitCategory: 'le6x' | 'le8x' | 'le10x' | string;
  deepValueCategory: 'le0.66' | string;
  moatKeywordsCategory: 'ge3' | 'ge5' | 'ge10' | string;
  insiderOwnershipCategory: 'ge8pct' | 'ge15pct' | 'ge25pct' | string;
  netInsiderBuysCategory: 'any' | 'ge3' | 'ge5' | string;
  grossMarginTrendCategory: 'improving' | 'stable' | 'any' | string;
  incrementalRoicCategory: 'ge15pct' | 'ge20pct' | 'ge25pct' | string;
  redFlagsCategory: 'auditChanges' | 'managementExits' | 'allRedFlags' | string;
}

export interface TopInstitutionalHolder {
  holder: string;
  shares: number;
  dateReported: string;
  change: number; // Change in shares
  weight?: number | null; // Portfolio weight
}

export interface InstitutionalOwnershipSummary {
  symbol: string;
  cik: string | null;
  date: string; // Date of the data
  institutionalOwnershipPercentage: number | null; // Overall institutional ownership %
  numberOfInstitutionalPositions: number | null;
  totalInstitutionalValue: number | null; // Total value held by institutions
  // Add other fields as provided by FMP's /institutional-ownership endpoint
}

export interface EarningsCallTranscriptMeta {
  symbol: string;
  quarter: number;
  year: number;
  date: string; // Date of the transcript
  url: string; // URL to the full transcript if available in metadata
  // content might be too large for meta, typically fetched separately or via URL
}

export interface StockDetails extends Stock {
  description: string;
  dividendYield: string; 
  '52WeekHigh': string;
  '52WeekLow': string;
  latestNews: { title: string; url: string; date: string }[];
  image?: string;
  website?: string;
  ceo?: string;
  industry?: string;
  fullTimeEmployees?: string;

  // Data for charts
  historicalPriceData?: HistoricalPricePoint[];
  historicalFinancials?: HistoricalFinancialDataPoint[];

  // New fields for Ultimate Plan data
  institutionalOwnershipSummary?: InstitutionalOwnershipSummary | null;
  topInstitutionalHolders?: TopInstitutionalHolder[];
  latestTranscript?: EarningsCallTranscriptMeta | null;
}

export interface ActiveFilters {
  [key: string]: string | undefined;
  // Updated to reflect potential new thematic group keys
  // Example:
  // size?: string; // Replaces marketCap, volume
  // capitalStructure_debtEquity?: string; // Example: if 'debt' filter moves under 'Capital Structure'
  // profitability_roe?: string; // Example
  // valuation_peRatio?: string; // Example
  
  // Keeping existing for now until groups are fully refactored
  marketCap?: string;
  volume?: string;
  debt?: string; // This corresponds to debtEquityRatio filter
  valuation?: string; // This corresponds to peRatio filter
  rotce?: string; // This corresponds to roe filter
  
  // Numeric Gates - these keys need to match SubFilterGroupDef ids
  debtToEbitda?: string; // Corrected from debtEbitda
  fcfToNetIncome?: string; // Corrected from fcfNiRatio
  shareCountChange?: string; // Corrected from shareCountCagr
  evToEbit?: string; // Corrected from evEbit
  priceToNCAV?: string; // Corrected from deepValue
  
  // Qualitative - these keys need to match SubFilterGroupDef ids
  moatKws?: string; // Corrected from moatKeywords
  insiderOwn?: string; // Corrected from insiderOwnership
  netInsiderTrx?: string; // Corrected from netInsiderBuys
  gmTrend?: string; // Corrected from grossMarginTrend
  incRoic?: string; // Corrected from incrementalRoic
  rdFlags?: string; // Corrected from redFlags

  // Catalyst
  catalyst_spinOff?: string; // Example
}

export type Theme = 'light' | 'dark';

export interface KeyMetricVisibility {
  stocksPassingFilters: boolean;
  avgDebtEbitda: boolean;
  avgEvEbit: boolean;
  avgFcfNi: boolean;
  avgRotce: boolean;
  price: boolean;
  simpleScore: boolean; // Added
  debtEbitdaIndividual: boolean;
  evEbitIndividual: boolean;
  fcfNiIndividual: boolean;
  rotceIndividual: boolean;
  peRatioIndividual: boolean; // P/E Ratio
}

export interface DisplayMetricConfig {
  id: keyof Stock | keyof KeyMetricVisibility | 'avgDebtEbitda' | 'avgEvEbit' | 'avgFcfNi' | 'avgRotce' | 'stocksPassingFilters' | 'debtEbitdaIndividual' | 'evEbitIndividual' | 'fcfNiIndividual' | 'rotceIndividual' | 'simpleScore' | 'peRatioIndividual';
  label: string;
  type: 'summary' | 'individual';
  dataKey?: keyof Stock; 
  alwaysVisible?: boolean; 
  formatter?: (value: any) => string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface SubFilterGroupDef {
  id: string; // This ID will be the key in ActiveFilters
  title: string;
  options: FilterOption[];
  tooltip?: string;
  controlType?: 'buttons' | 'slider'; // New for liquidity slider
  sliderMin?: number; // New
  sliderMax?: number; // New
  sliderStep?: number; // New
  sliderDefault?: number; // New
}

export interface FilterGroupDef {
  id: string; 
  title: string;
  emoji: string;
  tooltip?: string;
  subGroups?: SubFilterGroupDef[];
  options?: FilterOption[]; // For groups without subGroups (e.g. Catalysts)
  controlType?: 'checkboxes'; // For groups like Catalysts
}

export interface Preset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  filters: ActiveFilters;
}

export type StyleTag = '⚡ High Momentum' | '🛡️ Deep Value' | '🌱 Quality Compounder' | ' profitableTTM' | 'highPE';


// FMP API Response Types (simplified)
export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  marketCap: number | null;
  avgVolume: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  exchange: string;
  pe: number | null; 
}

export interface FMPRatiosTTM {
  symbol: string;
  debtEquityRatioTTM: number | null;
  priceEarningsRatioTTM: number | null;
  returnOnEquityTTM: number | null;
  returnOnTangibleEquityTTM: number | null; 
  netIncomePerShareTTM?: number | null;
}

export interface FMPKeyMetricsTTM {
  symbol: string;
  debtToEbitdaTTM: number | null;
  enterpriseValueOverEBITDATTM: number | null; 
  freeCashFlowPerShareTTM?: number | null;
}

export interface FMPProfile {
    symbol: string;
    price: number;
    beta: number;
    volAvg: number;
    mktCap: number;
    lastDiv: number;
    range: string;
    changes: number;
    companyName: string;
    currency: string;
    cik: string;
    isin: string;
    cusip: string;
    exchange: string;
    exchangeShortName: string;
    industry: string;
    website: string;
    description: string;
    ceo: string;
    sector: string;
    country: string;
    fullTimeEmployees: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dcfDiff: number;
    dcf: number;
    image: string;
    ipoDate: string;
    defaultImage: boolean;
    isEtf: boolean;
    isActivelyTrading: boolean;
    isAdr: boolean;
    isFund: boolean;
}

export interface FMPScreenerResult {
    symbol: string;
    companyName: string;
    marketCap: number | null;
    sector: string | null;
    industry: string | null;
    beta: number | null;
    price: number | null;
    lastAnnualDividend: number | null;
    volume: number | null;
    exchange: string | null;
    exchangeShortName: string | null;
    country: string | null;
    isEtf: boolean;
    isActivelyTrading: boolean;
    isFund?: boolean; // Added isFund
}

export interface FMPStockNewsItem {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

// For Chart data
export interface FMPHistoricalPriceDataEntry { // From /historical-price-full
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}
export interface FMPHistoricalPriceData {
  symbol: string;
  historical: FMPHistoricalPriceDataEntry[];
}


export interface FMPAnnualIncomeStatement {
    date: string;
    symbol: string;
    reportedCurrency: string;
    cik: string;
    fillingDate: string;
    acceptedDate: string;
    calendarYear: string;
    period: string;
    revenue: number;
    costOfRevenue: number;
    grossProfit: number;
    grossProfitRatio: number;
    researchAndDevelopmentExpenses: number;
    generalAndAdministrativeExpenses: number;
    sellingAndMarketingExpenses: number;
    sellingGeneralAndAdministrativeExpenses: number;
    otherExpenses: number;
    operatingExpenses: number;
    costAndExpenses: number;
    interestIncome: number;
    interestExpense: number;
    depreciationAndAmortization: number;
    ebitda: number;
    ebitdaratio: number;
    operatingIncome: number;
    operatingIncomeRatio: number;
    totalOtherIncomeExpensesNet: number;
    incomeBeforeTax: number;
    incomeBeforeTaxRatio: number;
    incomeTaxExpense: number;
    netIncome: number;
    netIncomeRatio: number;
    eps: number;
    epsdiluted: number;
    weightedAverageShsOut: number;
    weightedAverageShsOutDil: number;
    link: string;
    finalLink: string;
}

export interface FMPAnnualBalanceSheet {
    date: string;
    symbol: string;
    reportedCurrency: string;
    cik: string;
    fillingDate: string;
    acceptedDate: string;
    calendarYear: string;
    period: string;
    cashAndCashEquivalents: number;
    shortTermInvestments: number;
    cashAndShortTermInvestments: number;
    netReceivables: number;
    inventory: number;
    otherCurrentAssets: number;
    totalCurrentAssets: number;
    propertyPlantEquipmentNet: number;
    goodwill: number | null; // Can be null
    intangibleAssets: number | null; // Can be null
    goodwillAndIntangibleAssets: number | null; // Can be null
    longTermInvestments: number;
    taxAssets: number;
    otherNonCurrentAssets: number;
    totalNonCurrentAssets: number;
    otherAssets: number;
    totalAssets: number;
    accountPayables: number;
    shortTermDebt: number;
    taxPayables: number;
    deferredRevenue: number;
    otherCurrentLiabilities: number;
    totalCurrentLiabilities: number;
    longTermDebt: number;
    deferredRevenueNonCurrent: number;
    deferredTaxLiabilitiesNonCurrent: number;
    otherNonCurrentLiabilities: number;
    totalNonCurrentLiabilities: number;
    otherLiabilities: number;
    capitalLeaseObligations: number;
    totalLiabilities: number;
    preferredStock: number;
    commonStock: number;
    retainedEarnings: number;
    accumulatedOtherComprehensiveIncomeLoss: number;
    othertotalStockholdersEquity: number;
    totalStockholdersEquity: number;
    totalEquity: number;
    totalLiabilitiesAndStockholdersEquity: number;
    minorityInterest: number;
    totalLiabilitiesAndTotalEquity: number;
    totalInvestments: number;
    totalDebt: number;
    netDebt: number;
    link: string;
    finalLink: string;
}


// FMP types for new data
export interface FMPInstitutionalOwnership { // For /institutional-ownership/{symbol}
  symbol: string;
  cik: string | null;
  date: string;
  institutionalOwnershipPercentage: number | null;
  numberOfInstitutionalPositions: number | null;
  totalInstitutionalValue: number | null;
  // ... any other fields FMP provides
}

export interface FMPTopInstitutionalHolder { // For /institutional-holder/{symbol}
  holder: string;
  shares: number;
  dateReported: string;
  change: number; // Change in shares (can be negative)
  weight?: number | null; // Portfolio weight for the holder
  // ... any other fields FMP provides
}

export interface FMPEarningsTranscriptMeta { // For /earning_call_transcripts/{symbol}
  symbol: string;
  quarter: number;
  year: number;
  date: string;
  // FMP structure might vary, we're primarily interested in a URL to the transcript.
  // It might be directly in the response or need to be constructed.
  // For now, let's assume a direct 'url' field.
  url: string; // URL to the full transcript or a page containing it
  // content?: string; // Full content might be too large, often a link is better
}
