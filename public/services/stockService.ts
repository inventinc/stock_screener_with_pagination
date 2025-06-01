
console.log("[stockService.ts] Module execution started."); // Diagnostic log

import { 
    Stock, StockDetails, 
    FMPQuote, FMPRatiosTTM, FMPKeyMetricsTTM, FMPProfile, FMPScreenerResult, FMPStockNewsItem,
    HistoricalPricePoint, HistoricalFinancialDataPoint,
    FMPHistoricalPriceData, FMPAnnualIncomeStatement, FMPAnnualBalanceSheet,
    InstitutionalOwnershipSummary, TopInstitutionalHolder, EarningsCallTranscriptMeta, // New types for Ultimate plan data
    FMPInstitutionalOwnership, FMPTopInstitutionalHolder, FMPEarningsTranscriptMeta // Raw FMP types
} from '../types';
import { INITIAL_STOCK_LOAD_COUNT } from '../constants';

const getApiKey = (): string | undefined => {
  console.log("[stockService.ts] getApiKey called."); // Diagnostic log
  if (typeof window !== 'undefined' &&
      (window as any).APP_CONFIG &&
      (window as any).APP_CONFIG.FMP_API_KEY &&
      (window as any).APP_CONFIG.FMP_API_KEY !== "YOUR_FMP_API_KEY_HERE") {
    console.log("[stockService.ts] API key found in window.APP_CONFIG."); // Diagnostic log
    return (window as any).APP_CONFIG.FMP_API_KEY;
  }
  // Check if process and process.env are defined before trying to access API_KEY
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.API_KEY) {
    console.log("[stockService.ts] API key found in process.env."); // Diagnostic log
    return process.env.API_KEY;
  }
  console.log("[stockService.ts] No API key found."); // Diagnostic log
  return undefined; // Explicitly return undefined if no key found
};

const API_KEY = getApiKey();
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const FMP_V4_BASE_URL = 'https://financialmodelingprep.com/api/v4'; // For some newer endpoints

const NA_STRING = "N/A";

export class FMPApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "FMPApiError";
  }
}

const safeNum = (val: any): number | null => (typeof val === 'number' && isFinite(val) ? val : null);
const formatNum = (val: number | null | undefined, decimals = 2, suffix = ''): string => {
  if (val === null || val === undefined || isNaN(val)) return NA_STRING;
  return val.toFixed(decimals) + suffix;
};

const getMarketCapCategory = (marketCap: number | null | undefined): Stock['marketCapCategory'] => {
  if (marketCap === null || marketCap === undefined) return NA_STRING;
  if (marketCap >= 2_000_000_000) return 'midLarge'; // Merged Mid/Large
  if (marketCap >= 300_000_000) return 'small';
  if (marketCap >= 50_000_000) return 'micro';
  if (marketCap > 0) return 'nano'; // New Nano category
  return NA_STRING;
};

const getVolumeCategory = (avgVolume: number | null | undefined): Stock['volumeCategory'] => {
  if (avgVolume === null || avgVolume === undefined) return NA_STRING;
  if (avgVolume >= 1_000_000) return 'high';
  if (avgVolume >= 100_000) return 'medium';
  if (avgVolume > 0) return 'low';
  return NA_STRING;
};

// For Debt/Equity ratio
const getDebtCategory = (debtEquityRatio: number | null | undefined): Stock['debtCategory'] => {
  if (debtEquityRatio === null || debtEquityRatio === undefined) return NA_STRING;
  if (debtEquityRatio < 0.5) return 'low';
  if (debtEquityRatio <= 1.0) return 'medium';
  return 'high';
};

// For P/E ratio
const getValuationCategory = (peRatio: number | null | undefined): Stock['valuationCategory'] => {
  if (peRatio === null || peRatio === undefined) return NA_STRING;
  if (peRatio < 15 && peRatio > 0) return 'value';
  if (peRatio > 25) return 'growth';
  if (peRatio >=15 && peRatio <=25) return 'blend';
  return NA_STRING; 
};

// For ROE (used as ROTCE proxy)
const getRotceCategory = (roe: number | null | undefined): Stock['rotceCategory'] => { 
  if (roe === null || roe === undefined) return NA_STRING;
  const roePercent = roe * 100;
  if (roePercent > 20) return 'excellent';
  if (roePercent >= 15) return 'good';
  if (roePercent >= 10) return 'average';
  return 'poor';
};

// Simplified score color logic for 0-100 score
export const getSimpleScoreColor = (score?: number): string => {
    if (score === undefined || score === null) return 'bg-gray-400 dark:bg-gray-600';
    if (score >= 75) return 'bg-green-500 text-white';
    if (score >= 50) return 'bg-blue-500 text-white';
    if (score >= 25) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
};
export const getTextSimpleScoreColor = (score?: number): string => {
    if (score === undefined || score === null) return 'text-gray-500 dark:text-gray-400';
    if (score >= 75) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-blue-600 dark:text-blue-400';
    if (score >= 25) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
};


const calculateSimpleScore = (peRatioTTM: number | null, roeTTM: number | null): number => {
    let score = 0;
    const peWeight = 40; // Max 40 points for PE
    const roeWeight = 60; // Max 60 points for ROE

    // ROE scoring (max 60 points)
    // ROE > 20% = 60 pts, 15-20% = 45 pts, 10-15% = 30pts, 5-10% = 15pts, <5% = 0 pts
    if (roeTTM !== null) {
        if (roeTTM > 0.20) score += roeWeight;
        else if (roeTTM > 0.15) score += roeWeight * 0.75;
        else if (roeTTM > 0.10) score += roeWeight * 0.5;
        else if (roeTTM > 0.05) score += roeWeight * 0.25;
    }

    // P/E scoring (max 40 points for P/E > 0)
    // Lower P/E is better. PE < 10 = 40pts, 10-15 = 30pts, 15-20 = 20pts, 20-25 = 10pts, >25 = 0pts
    if (peRatioTTM !== null && peRatioTTM > 0) {
        if (peRatioTTM < 10) score += peWeight;
        else if (peRatioTTM < 15) score += peWeight * 0.75;
        else if (peRatioTTM < 20) score += peWeight * 0.5;
        else if (peRatioTTM < 25) score += peWeight * 0.25;
    }
    return Math.round(Math.max(0, Math.min(100, score)));
};


export const fetchStockListFromFMP = async (): Promise<Stock[]> => {
  console.log("[stockService.ts] fetchStockListFromFMP called.");
  if (!API_KEY) {
    const errMsg = "FMP API Key is missing. Please ensure it is set correctly in index.html (window.APP_CONFIG.FMP_API_KEY) or as process.env.API_KEY in your environment.";
    console.error(errMsg);
    throw new FMPApiError(errMsg, 401);
  }

  try {
    const screenerUrl = `${FMP_BASE_URL}/stock-screener?limit=${INITIAL_STOCK_LOAD_COUNT + 200}&exchange=NASDAQ,NYSE,OTC&isActivelyTrading=true&apikey=${API_KEY}`;
    console.log(`[stockService.ts] Fetching screener data from: ${screenerUrl.replace(API_KEY, "REDACTED_API_KEY")}`);
    const screenerResponse = await fetch(screenerUrl);
    
    if (!screenerResponse.ok) {
      const errorText = await screenerResponse.text().catch(() => "Could not retrieve error details.");
      console.error(`FMP Screener API error: ${screenerResponse.status}. Response: ${errorText}`);
      if (screenerResponse.status === 401) {
        throw new FMPApiError(
            `FMP API Authentication Failed (401 Unauthorized). Please verify that the API_KEY used is correct, active, and has permissions for the screener API. Check index.html or your environment variables.`, 
            screenerResponse.status
        );
      }
      throw new FMPApiError(
          `FMP Screener API request failed with status ${screenerResponse.status}. Details: ${errorText}`, 
          screenerResponse.status
      );
    }
    const screenerDataFull: FMPScreenerResult[] = await screenerResponse.json();
    
    if (!Array.isArray(screenerDataFull)) {
        console.error('FMP Screener data is not an array:', screenerDataFull);
        throw new FMPApiError('Received invalid data format from FMP Screener.', 500);
    }
    console.log(`[stockService.ts] Received ${screenerDataFull.length} items from screener.`);

    const eligibleScreenerItems = screenerDataFull.filter(item => {
        if (item.isEtf) return false;
        if (item.isFund) return false;
        return item.isActivelyTrading !== false;
    }).slice(0, INITIAL_STOCK_LOAD_COUNT); // Apply INITIAL_STOCK_LOAD_COUNT limit here
    console.log(`[stockService.ts] Filtered down to ${eligibleScreenerItems.length} eligible items for detailed fetching.`);

    const CHUNK_SIZE = 5; // Number of stocks to fetch details for in parallel
    const DELAY_BETWEEN_CHUNKS = 1000; // Milliseconds (1 second)
    const allResolvedStocks: (Stock | null)[] = [];

    for (let i = 0; i < eligibleScreenerItems.length; i += CHUNK_SIZE) {
        const chunk = eligibleScreenerItems.slice(i, i + CHUNK_SIZE);
        console.log(`[stockService.ts] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(eligibleScreenerItems.length / CHUNK_SIZE)}. Size: ${chunk.length}`);

        const stockPromisesInChunk = chunk.map(async (screenerItem): Promise<Stock | null> => {
          try {
            const ratiosUrl = `${FMP_BASE_URL}/ratios-ttm/${screenerItem.symbol}?apikey=${API_KEY}`;
            const keyMetricsUrl = `${FMP_BASE_URL}/key-metrics-ttm/${screenerItem.symbol}?apikey=${API_KEY}`;

            let ratiosResponse, keyMetricsResponse;
            try {
                [ratiosResponse, keyMetricsResponse] = await Promise.all([
                  fetch(ratiosUrl),
                  fetch(keyMetricsUrl)
                ]);
            } catch (fetchErr: any) { // Catch specific fetch errors
                console.error(`Network error during fetch for ${screenerItem.symbol}:`, fetchErr.message || fetchErr);
                return null; // Return null for this stock, allow others to proceed
            }

            let ratiosData: FMPRatiosTTM | null = null;
            if (ratiosResponse.ok) {
              const rawRatios = await ratiosResponse.json();
              ratiosData = (Array.isArray(rawRatios) && rawRatios.length > 0) ? rawRatios[0] : null;
            } else if (ratiosResponse.status !== 404) { 
               console.warn(`FMP Ratios API error for ${screenerItem.symbol}: ${ratiosResponse.status}. URL: ${ratiosUrl.replace(API_KEY, "REDACTED_API_KEY")}`);
            }

            let keyMetricsData: FMPKeyMetricsTTM | null = null;
            if (keyMetricsResponse.ok) {
              const rawKeyMetrics = await keyMetricsResponse.json();
              keyMetricsData = (Array.isArray(rawKeyMetrics) && rawKeyMetrics.length > 0) ? rawKeyMetrics[0] : null;
            } else if (keyMetricsResponse.status !== 404) {
               console.warn(`FMP KeyMetrics API error for ${screenerItem.symbol}: ${keyMetricsResponse.status}. URL: ${keyMetricsUrl.replace(API_KEY, "REDACTED_API_KEY")}`);
            }
            
            const marketCap = safeNum(screenerItem.marketCap);
            const avgVolume = safeNum(screenerItem.volume); 
            const price = safeNum(screenerItem.price);

            const peRatioTTM = ratiosData ? safeNum(ratiosData.priceEarningsRatioTTM) : null;
            const debtEquityRatioTTM = ratiosData ? safeNum(ratiosData.debtEquityRatioTTM) : null;
            const roeTTM = ratiosData ? (safeNum(ratiosData.returnOnTangibleEquityTTM) ?? safeNum(ratiosData.returnOnEquityTTM)) : null; 
            
            const debtToEbitdaTTM = keyMetricsData ? safeNum(keyMetricsData.debtToEbitdaTTM) : null;
            const evOverEbitdaTTM = keyMetricsData ? safeNum(keyMetricsData.enterpriseValueOverEBITDATTM) : null; 

            const fcfPerShareTTM = keyMetricsData ? safeNum(keyMetricsData.freeCashFlowPerShareTTM) : null;
            const netIncomePerShareTTM = ratiosData ? safeNum(ratiosData.netIncomePerShareTTM) : null;
            let fcfNiRatio: number | null = null;
            if (fcfPerShareTTM !== null && netIncomePerShareTTM !== null && netIncomePerShareTTM !== 0) {
                fcfNiRatio = fcfPerShareTTM / netIncomePerShareTTM;
            }
            
            const simpleScore = calculateSimpleScore(peRatioTTM, roeTTM);
            let styleTags: Stock['styleTags'] = [];
            if (peRatioTTM !== null && peRatioTTM > 30) styleTags.push('highPE');
            if (roeTTM !== null && roeTTM > 0) styleTags.push(' profitableTTM');

            return {
              id: screenerItem.symbol,
              symbol: screenerItem.symbol,
              name: screenerItem.companyName || NA_STRING,
              sector: screenerItem.sector || NA_STRING,
              price: price ?? 0,
              simpleScore: simpleScore,
              styleTags: styleTags,
              
              marketCap: marketCap ?? undefined,
              avgVolume: avgVolume ?? undefined,
              peRatioTTM: peRatioTTM,
              debtEquityRatioTTM: debtEquityRatioTTM,
              returnOnEquityTTM: roeTTM, 
              debtToEbitdaTTM: debtToEbitdaTTM,
              enterpriseValueOverEBITDATTM: evOverEbitdaTTM,
              freeCashFlowPerShareTTM: fcfPerShareTTM,
              netIncomePerShareTTM: netIncomePerShareTTM,

              marketCapCategory: getMarketCapCategory(marketCap),
              volumeCategory: getVolumeCategory(avgVolume),
              debtCategory: getDebtCategory(debtEquityRatioTTM), 
              valuationCategory: getValuationCategory(peRatioTTM), 
              rotceCategory: getRotceCategory(roeTTM), 
              
              debtEbitda: formatNum(debtToEbitdaTTM, 2, 'x'), 
              evEbit: formatNum(evOverEbitdaTTM, 2, 'x'), 
              fcfNi: formatNum(fcfNiRatio, 2), 
              rotce: formatNum(roeTTM !== null ? roeTTM * 100 : null, 1, '%'),

              numericDebtEbitdaCategory: debtToEbitdaTTM !== null ? (debtToEbitdaTTM <= 0.25 ? 'le0.25x' : debtToEbitdaTTM <= 0.5 ? 'le0.5x' : debtToEbitdaTTM <= 1 ? 'le1x' : '') : '',
              numericFcfNiCategory: fcfNiRatio !== null ? (fcfNiRatio >= 1.2 ? 'ge1.2' : fcfNiRatio >= 1.0 ? 'ge1.0' : fcfNiRatio >= 0.8 ? 'ge0.8' : '') : '',
              
              shareCountCagrCategory: NA_STRING, 
              numericEvEbitCategory: NA_STRING, 
              deepValueCategory: NA_STRING, 
              moatKeywordsCategory: NA_STRING, 
              insiderOwnershipCategory: NA_STRING, 
              netInsiderBuysCategory: NA_STRING, 
              grossMarginTrendCategory: NA_STRING, 
              incrementalRoicCategory: NA_STRING, 
              redFlagsCategory: NA_STRING, 
            };
          } catch (e: any) {
            console.error(`Error processing stock ${screenerItem.symbol} in chunk mapping:`, e.message || e);
            return null;
          }
        });

        try {
            const resolvedStocksInChunk = await Promise.all(stockPromisesInChunk);
            allResolvedStocks.push(...resolvedStocksInChunk);
        } catch (chunkError: any) {
            // This catch is less likely to be hit if individual promises handle their errors and return null.
            // However, it's a safeguard.
            console.error(`[stockService.ts] Critical error processing a chunk of stocks:`, chunkError.message || chunkError);
        }
      
        if (i + CHUNK_SIZE < eligibleScreenerItems.length) {
            console.log(`[stockService.ts] Delaying for ${DELAY_BETWEEN_CHUNKS}ms before next chunk.`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
        }
    }

    const finalStocks = allResolvedStocks.filter(stock => stock !== null) as Stock[];
    console.log(`[stockService.ts] Processed ${finalStocks.length} stocks after detailed fetching with chunking.`);
    return finalStocks;

  } catch (error) {
    if (error instanceof FMPApiError) throw error; 
    console.error("Error fetching stock list from FMP:", error);
    throw new FMPApiError("An unexpected error occurred while fetching stock list.", 500);
  }
};


const fetchHistoricalPriceData = async (symbol: string, days: number = 90): Promise<HistoricalPricePoint[]> => {
  if (!API_KEY) throw new FMPApiError("API Key not found for historical price data.", 401);
  const url = `${FMP_BASE_URL}/historical-price-full/${symbol}?timeseries=${days}&apikey=${API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) throw new FMPApiError(`FMP API Auth Failed (401) for historical price of ${symbol}`, 401);
      console.warn(`FMP Historical Price API error for ${symbol}: ${response.status}. URL: ${url.replace(API_KEY, "REDACTED_API_KEY")}`);
      return [];
    }
    const data: FMPHistoricalPriceData = await response.json();
    if (data && Array.isArray(data.historical)) {
      return data.historical.map(item => ({ date: item.date, close: item.close })).reverse();
    }
    return [];
  } catch (error: any) {
    console.error(`Error fetching historical price data for ${symbol}:`, error.message || error);
    return [];
  }
};

const fetchHistoricalFinancialStatements = async (symbol: string, years: number = 12): Promise<HistoricalFinancialDataPoint[]> => {
  if (!API_KEY) throw new FMPApiError("API Key not found for historical financials.", 401);

  const incomeStmtUrl = `${FMP_BASE_URL}/income-statement/${symbol}?period=annual&limit=${years}&apikey=${API_KEY}`;
  const balanceSheetUrl = `${FMP_BASE_URL}/balance-sheet-statement/${symbol}?period=annual&limit=${years}&apikey=${API_KEY}`;

  try {
    const [incomeResponse, balanceSheetResponse] = await Promise.all([
      fetch(incomeStmtUrl),
      fetch(balanceSheetUrl)
    ]);

    if (!incomeResponse.ok || !balanceSheetResponse.ok) {
        if (incomeResponse.status === 401 || balanceSheetResponse.status === 401) {
            throw new FMPApiError(`FMP API Auth Failed (401) for historical financials of ${symbol}`, 401);
        }
      console.warn(`Error fetching historical financials for ${symbol}. Income: ${incomeResponse.status}, Balance Sheet: ${balanceSheetResponse.status}`);
      return [];
    }

    const incomeData: FMPAnnualIncomeStatement[] = await incomeResponse.json();
    const balanceSheetData: FMPAnnualBalanceSheet[] = await balanceSheetResponse.json();

    if (!Array.isArray(incomeData) || !Array.isArray(balanceSheetData)) {
        console.warn(`Invalid data format for historical financials for ${symbol}`);
        return [];
    }

    const combinedData: HistoricalFinancialDataPoint[] = [];

    incomeData.forEach(incomeItem => {
      const correspondingBalanceSheet = balanceSheetData.find(bsItem => bsItem.calendarYear === incomeItem.calendarYear);
      if (correspondingBalanceSheet) {
        const netIncome = safeNum(incomeItem.netIncome);
        const totalStockholdersEquity = safeNum(correspondingBalanceSheet.totalStockholdersEquity);
        const goodwill = safeNum(correspondingBalanceSheet.goodwill) ?? 0;
        const intangibleAssets = safeNum(correspondingBalanceSheet.intangibleAssets) ?? 0;
        const totalGoodwillAndIntangibles = (goodwill + intangibleAssets > 0) 
            ? (goodwill + intangibleAssets)
            : safeNum(correspondingBalanceSheet.goodwillAndIntangibleAssets) ?? 0;


        let calculatedROTCE: number | null = null;
        if (netIncome !== null && totalStockholdersEquity !== null) {
          const tangibleCommonEquity = totalStockholdersEquity - totalGoodwillAndIntangibles;
          if (tangibleCommonEquity > 0) {
            calculatedROTCE = netIncome / tangibleCommonEquity;
          }
        }
        
        combinedData.push({
          year: parseInt(incomeItem.calendarYear, 10),
          fiscalDateEnding: incomeItem.date,
          reportedCurrency: incomeItem.reportedCurrency,
          commonStockSharesOutstanding: safeNum(correspondingBalanceSheet.commonStock), 
          netIncome: netIncome,
          totalStockholdersEquity: totalStockholdersEquity,
          goodwill: goodwill,
          intangibleAssets: intangibleAssets,
          calculatedROTCE: calculatedROTCE,
        });
      }
    });
    
    return combinedData.sort((a, b) => a.year - b.year);

  } catch (error: any) {
    console.error(`Error fetching historical financial statements for ${symbol}:`, error.message || error);
    return [];
  }
};


export const fetchStockDetailsFromFMP = async (stockSymbol: string): Promise<StockDetails | null> => {
  console.log(`[stockService.ts] fetchStockDetailsFromFMP called for ${stockSymbol}.`); // Diagnostic log
  if (!API_KEY) {
    const errMsg = "FMP API Key is missing. Please ensure it is set correctly in index.html (window.APP_CONFIG.FMP_API_KEY) or as process.env.API_KEY in your environment.";
    console.error(errMsg);
    throw new FMPApiError(errMsg, 401);
  }
  try {
    const profileUrl = `${FMP_BASE_URL}/profile/${stockSymbol}?apikey=${API_KEY}`;
    const quoteUrl = `${FMP_BASE_URL}/quote/${stockSymbol}?apikey=${API_KEY}`; 
    const ratiosUrl = `${FMP_BASE_URL}/ratios-ttm/${stockSymbol}?apikey=${API_KEY}`;
    const keyMetricsUrl = `${FMP_BASE_URL}/key-metrics-ttm/${stockSymbol}?apikey=${API_KEY}`;
    const newsUrl = `${FMP_BASE_URL}/stock_news?tickers=${stockSymbol}&limit=5&apikey=${API_KEY}`;
    // New Ultimate Plan Data URLs
    const institutionalOwnershipUrl = `${FMP_V4_BASE_URL}/institutional-ownership/symbol_ownership?symbol=${stockSymbol}&apikey=${API_KEY}`;
    const topInstitutionalHoldersUrl = `${FMP_BASE_URL}/institutional-holder/${stockSymbol}?limit=5&apikey=${API_KEY}`;
    // FMP v4 endpoint for earning call transcripts list
    const earningsTranscriptsListUrl = `${FMP_V4_BASE_URL}/batch_earning_call_transcript/${stockSymbol}?apikey=${API_KEY}`;


    console.log(`[stockService.ts] Fetching details for ${stockSymbol}. Profile URL: ${profileUrl.replace(API_KEY, "REDACTED_API_KEY")}`);

    let profileRes, quoteRes, ratiosRes, keyMetricsRes, newsRes, 
        institutionalOwnershipRes, topHoldersRes, transcriptsListRes,
        historicalPrice, historicalFinancials;
    
    try {
        [profileRes, quoteRes, ratiosRes, keyMetricsRes, newsRes, 
         institutionalOwnershipRes, topHoldersRes, transcriptsListRes] = await Promise.all([
          fetch(profileUrl),
          fetch(quoteUrl),
          fetch(ratiosUrl),
          fetch(keyMetricsUrl),
          fetch(newsUrl),
          fetch(institutionalOwnershipUrl),
          fetch(topInstitutionalHoldersUrl),
          fetch(earningsTranscriptsListUrl)
        ].map(p => p.catch(e => { // Add individual catch for each fetch in Promise.all
            console.error(`A fetch operation failed for ${stockSymbol}:`, e.message || e);
            return new Response(null, {status: 503, statusText: "Service Unavailable or Network Error"}); // Return a mock error response
        })));
        
        const historicalPricePromise = fetchHistoricalPriceData(stockSymbol);
        const historicalFinancialsPromise = fetchHistoricalFinancialStatements(stockSymbol);
        
        historicalPrice = await historicalPricePromise;
        historicalFinancials = await historicalFinancialsPromise;

    } catch (fetchErr: any) { // This catch is now less likely for individual fetches but good for Promise.all itself
        console.error(`General network error during initial detail fetch for ${stockSymbol}:`, fetchErr.message || fetchErr);
        throw new FMPApiError(`Network error fetching details for ${stockSymbol}. This can be due to internet connectivity issues or the API server being temporarily unavailable.`, 500);
    }

    if (!profileRes.ok) {
        const errorStatus = profileRes.status;
        const errorText = await profileRes.text().catch(() => `Status: ${errorStatus}`);
        let message = `Failed to fetch FMP profile data for ${stockSymbol}. Status: ${errorStatus}. Details: ${errorText}`;
        if (errorStatus === 401) message = `FMP API Authentication Failed (401) for profile of ${stockSymbol}. Key: ${API_KEY ? API_KEY.substring(0,4) + '...' : 'MISSING'}`;
        else if (errorStatus === 429) message = `FMP API rate limit reached (429) for profile of ${stockSymbol}.`;
        else if (errorStatus === 503 && profileRes.statusText === "Service Unavailable or Network Error") message = `Network error or FMP service unavailable when fetching profile for ${stockSymbol}.`;
        console.error(message);
        throw new FMPApiError(message, errorStatus);
    }

    if (!quoteRes.ok) {
        const errorStatus = quoteRes.status;
        const errorText = await quoteRes.text().catch(() => `Status: ${errorStatus}`);
        let message = `Failed to fetch FMP quote data for ${stockSymbol}. Status: ${errorStatus}. Details: ${errorText}`;
        if (errorStatus === 401) message = `FMP API Authentication Failed (401) for quote of ${stockSymbol}.`;
        else if (errorStatus === 429) message = `FMP API rate limit reached (429) for quote of ${stockSymbol}.`;
        else if (errorStatus === 503 && quoteRes.statusText === "Service Unavailable or Network Error") message = `Network error or FMP service unavailable when fetching quote for ${stockSymbol}.`;
        console.error(message);
        throw new FMPApiError(message, errorStatus);
    }
    
    const profileDataArr: FMPProfile[] = await profileRes.json();
    const quoteDataArr: FMPQuote[] = await quoteRes.json();
    
    const profile = profileDataArr?.[0];
    const quote = quoteDataArr?.[0];

    if (!profile || !quote) {
        console.error(`Missing profile or quote data for ${stockSymbol} after successful fetch.`);
        throw new FMPApiError(`Incomplete profile or quote data received for ${stockSymbol} (data structure issue).`, 500);
    }

    let ratios: FMPRatiosTTM | null = null;
    if (ratiosRes.ok) {
        const rawRatios = await ratiosRes.json();
        ratios = (Array.isArray(rawRatios) && rawRatios.length > 0) ? rawRatios[0] : null;
    } else if (ratiosRes.status !== 503) { // Don't warn for network errors already handled by Promise.all map
        console.warn(`FMP Ratios API error for ${stockSymbol}: ${ratiosRes.status}`);
    }


    let keyMetrics: FMPKeyMetricsTTM | null = null;
    if (keyMetricsRes.ok) {
        const rawKeyMetrics = await keyMetricsRes.json();
        keyMetrics = (Array.isArray(rawKeyMetrics) && rawKeyMetrics.length > 0) ? rawKeyMetrics[0] : null;
    } else if (keyMetricsRes.status !== 503) {
        console.warn(`FMP KeyMetrics API error for ${stockSymbol}: ${keyMetricsRes.status}`);
    }

    let newsData: FMPStockNewsItem[] = [];
    if (newsRes.ok) {
        newsData = await newsRes.json();
    } else if (newsRes.status !== 503) {
        console.warn(`FMP News API error for ${stockSymbol}: ${newsRes.status}`);
    }
    
    let institutionalOwnershipSummary: InstitutionalOwnershipSummary | null = null;
    if (institutionalOwnershipRes.ok) {
        const rawInstOwn = await institutionalOwnershipRes.json();
        if (Array.isArray(rawInstOwn) && rawInstOwn.length > 0) {
           const data = rawInstOwn[0] as FMPInstitutionalOwnership; 
           institutionalOwnershipSummary = {
               symbol: data.symbol,
               cik: data.cik,
               date: data.date,
               institutionalOwnershipPercentage: data.institutionalOwnershipPercentage,
               numberOfInstitutionalPositions: data.numberOfInstitutionalPositions,
               totalInstitutionalValue: data.totalInstitutionalValue
           };
        }
    } else if (institutionalOwnershipRes.status !== 503) {
        console.warn(`FMP Institutional Ownership Summary API error for ${stockSymbol}: ${institutionalOwnershipRes.status}`);
    }

    let topInstitutionalHolders: TopInstitutionalHolder[] = [];
    if (topHoldersRes.ok) {
        topInstitutionalHolders = (await topHoldersRes.json() as FMPTopInstitutionalHolder[]);
    } else if (topHoldersRes.status !== 503) {
        console.warn(`FMP Top Institutional Holders API error for ${stockSymbol}: ${topHoldersRes.status}`);
    }
    
    let latestTranscript: EarningsCallTranscriptMeta | null = null;
    if (transcriptsListRes.ok) {
        const transcripts: FMPEarningsTranscriptMeta[] = await transcriptsListRes.json();
        if (Array.isArray(transcripts) && transcripts.length > 0) {
            const latestRawTranscript = transcripts[0];
            latestTranscript = {
                symbol: latestRawTranscript.symbol,
                quarter: latestRawTranscript.quarter,
                year: latestRawTranscript.year,
                date: latestRawTranscript.date,
                url: `https://financialmodelingprep.com/api/v3/earning_call_transcript/${stockSymbol}?quarter=${latestRawTranscript.quarter}&year=${latestRawTranscript.year}&apikey=${API_KEY}` 
            };
        }
    } else if (transcriptsListRes.status !== 503) {
        console.warn(`FMP Earnings Transcripts List API error for ${stockSymbol}: ${transcriptsListRes.status}`);
    }


    const marketCap = safeNum(profile.mktCap);
    const avgVolume = safeNum(profile.volAvg);
    const price = safeNum(profile.price);

    const peRatioTTM = ratios ? safeNum(ratios.priceEarningsRatioTTM) : null;
    const debtEquityRatioTTM = ratios ? safeNum(ratios.debtEquityRatioTTM) : null;
    const roeTTM = ratios ? (safeNum(ratios.returnOnTangibleEquityTTM) ?? safeNum(ratios.returnOnEquityTTM)) : null;
    
    const debtToEbitdaTTM = keyMetrics ? safeNum(keyMetrics.debtToEbitdaTTM) : null;
    const evOverEbitdaTTM = keyMetrics ? safeNum(keyMetrics.enterpriseValueOverEBITDATTM) : null; 

    const fcfPerShareTTM = keyMetrics ? safeNum(keyMetrics.freeCashFlowPerShareTTM) : null;
    const netIncomePerShareTTM = ratios ? safeNum(ratios.netIncomePerShareTTM) : null;
    let fcfNiRatioNum: number | null = null;
    if (fcfPerShareTTM !== null && netIncomePerShareTTM !== null && netIncomePerShareTTM !== 0) {
        fcfNiRatioNum = fcfPerShareTTM / netIncomePerShareTTM;
    }

    const simpleScore = calculateSimpleScore(peRatioTTM, roeTTM);
    let styleTags: Stock['styleTags'] = [];
    if (peRatioTTM !== null && peRatioTTM > 30) styleTags.push('highPE');
    if (roeTTM !== null && roeTTM > 0) styleTags.push(' profitableTTM');

    const result: StockDetails = {
      id: profile.symbol,
      symbol: profile.symbol,
      name: profile.companyName || NA_STRING,
      sector: profile.sector || NA_STRING,
      price: price ?? 0,
      simpleScore: simpleScore,
      styleTags: styleTags,
      description: profile.description || "No description available.",
      
      marketCap: marketCap ?? undefined, 
      avgVolume: avgVolume ?? undefined,
      peRatioTTM: peRatioTTM,
      debtEquityRatioTTM: debtEquityRatioTTM,
      returnOnEquityTTM: roeTTM,
      debtToEbitdaTTM: debtToEbitdaTTM,
      enterpriseValueOverEBITDATTM: evOverEbitdaTTM,
      freeCashFlowPerShareTTM: fcfPerShareTTM,
      netIncomePerShareTTM: netIncomePerShareTTM,

      dividendYield: formatNum(safeNum(profile.lastDiv) && price ? (safeNum(profile.lastDiv)! / price!) * 100 : null, 2, '%'),
      '52WeekHigh': formatNum(safeNum(quote.yearHigh)),
      '52WeekLow': formatNum(safeNum(quote.yearLow)),
      latestNews: newsData.map(n => ({ title: n.title, url: n.url, date: new Date(n.publishedDate).toLocaleDateString() })).slice(0,5),
      image: profile.image,
      website: profile.website,
      ceo: profile.ceo,
      industry: profile.industry,
      fullTimeEmployees: profile.fullTimeEmployees,

      marketCapCategory: getMarketCapCategory(marketCap),
      volumeCategory: getVolumeCategory(avgVolume),
      debtCategory: getDebtCategory(debtEquityRatioTTM),
      valuationCategory: getValuationCategory(peRatioTTM),
      rotceCategory: getRotceCategory(roeTTM),
      
      debtEbitda: formatNum(debtToEbitdaTTM, 2, 'x'),
      evEbit: formatNum(evOverEbitdaTTM, 2, 'x'), 
      fcfNi: formatNum(fcfNiRatioNum, 2),
      rotce: formatNum(roeTTM !== null ? roeTTM * 100 : null, 1, '%'),

      numericDebtEbitdaCategory: debtToEbitdaTTM !== null ? (debtToEbitdaTTM <= 0.25 ? 'le0.25x' : debtToEbitdaTTM <= 0.5 ? 'le0.5x' : debtToEbitdaTTM <= 1 ? 'le1x' : '') : '',
      numericFcfNiCategory: fcfNiRatioNum !== null ? (fcfNiRatioNum >= 1.2 ? 'ge1.2' : fcfNiRatioNum >= 1.0 ? 'ge1.0' : fcfNiRatioNum >= 0.8 ? 'ge0.8' : '') : '',
      shareCountCagrCategory: NA_STRING,
      numericEvEbitCategory: NA_STRING,
      deepValueCategory: NA_STRING,
      moatKeywordsCategory: NA_STRING,
      insiderOwnershipCategory: NA_STRING,
      netInsiderBuysCategory: NA_STRING,
      grossMarginTrendCategory: NA_STRING,
      incrementalRoicCategory: NA_STRING,
      redFlagsCategory: NA_STRING,

      historicalPriceData: historicalPrice,
      historicalFinancials: historicalFinancials,

      institutionalOwnershipSummary: institutionalOwnershipSummary,
      topInstitutionalHolders: topInstitutionalHolders,
      latestTranscript: latestTranscript,
    };
    console.log(`[stockService.ts] Successfully fetched details for ${stockSymbol}.`); // Diagnostic log
    return result;

  } catch (error) {
    if (error instanceof FMPApiError) throw error; 
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching full details for ${stockSymbol}:`, errorMessage);
    if (error instanceof TypeError && errorMessage.includes("failed to fetch")) {
         throw new FMPApiError(`Network error prevented fetching details for ${stockSymbol}. Check connectivity.`, 500);
    }
    throw new FMPApiError(`An unexpected error occurred while fetching details for ${stockSymbol}. Error: ${errorMessage}`, 500); 
  }
};

export const formatMarketCap = (num: number | undefined): string => {
  if (num === undefined || num === null) return NA_STRING;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'; 
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  return num.toFixed(0); 
};

console.log("[stockService.ts] Module execution finished."); // Diagnostic log
    