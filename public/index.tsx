
console.log("[index.tsx] Module execution started."); // Diagnostic log

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
// Import types
import { Theme, Stock, StockDetails, ActiveFilters, KeyMetricVisibility, DisplayMetricConfig } from './types';
// Import constants
import { STOCKS_PER_PAGE, INITIAL_KEY_METRICS_VISIBILITY, DISPLAY_METRICS_CONFIG, INITIAL_STOCK_LOAD_COUNT } from './constants';
// Import services
import { fetchStockListFromFMP, fetchStockDetailsFromFMP, FMPApiError } from './services/stockService';
// Import components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KeyMetricsSection from './components/KeyMetricsSection';
import StocksSection from './components/StocksSection';
import { FilterIcon } from './components/icons';
import CustomizeMetricsModal from './components/CustomizeMetricsModal';
import StockDetailsModal from './components/StockDetailsModal';
import PresetWizardModal from './components/PresetWizardModal'; // New
import WatchlistPane from './components/WatchlistPane'; // New

const App: React.FC = () => {
  console.log("[App component] Initializing."); // Diagnostic log
  const [theme, setTheme] = useState<Theme>(() => {
    console.log("[App component] useState for theme."); // Diagnostic log
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // Robust check for window.matchMedia
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [stocksToDisplay, setStocksToDisplay] = useState<Stock[]>([]);
  
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentView, setCurrentView] = useState<'card' | 'table'>('card');
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  const [isCustomizeMetricsModalOpen, setIsCustomizeMetricsModalOpen] = useState<boolean>(false);
  const [isStockDetailsModalOpen, setIsStockDetailsModalOpen] = useState<boolean>(false);
  const [selectedStockDetails, setSelectedStockDetails] = useState<StockDetails | null>(null);
  const [isLoadingStockDetails, setIsLoadingStockDetails] = useState<boolean>(false);
  const [stockDetailsError, setStockDetailsError] = useState<string | null>(null);
  const [keyMetricsVisibility, setKeyMetricsVisibility] = useState<KeyMetricVisibility>(INITIAL_KEY_METRICS_VISIBILITY);

  const mainContentRef = useRef<HTMLDivElement>(null);

  // New Feature States
  const [isPresetWizardOpen, setIsPresetWizardOpen] = useState<boolean>(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [isWatchlistPaneOpen, setIsWatchlistPaneOpen] = useState<boolean>(false);


  // Load watchlist from localStorage
  useEffect(() => {
    console.log("[App component] useEffect for watchlist load."); // Diagnostic log
    const savedWatchlist = localStorage.getItem('stockScreenerWatchlist');
    if (savedWatchlist) {
      try {
        const parsedWatchlist = JSON.parse(savedWatchlist);
        if (Array.isArray(parsedWatchlist)) {
            setWatchlist(parsedWatchlist.filter(item => typeof item === 'string'));
        }
      } catch (e) {
        console.error("Error parsing watchlist from localStorage", e);
        setWatchlist([]);
      }
    }
  }, []);

  // Save watchlist to localStorage
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const newWatchlist = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
      localStorage.setItem('stockScreenerWatchlist', JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  };


  useEffect(() => {
    console.log("[App component] useEffect for theme application to DOM."); // Diagnostic log
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const loadInitialStocks = useCallback(async () => {
    console.log("[App component] loadInitialStocks called."); // Diagnostic log
    setIsInitialLoading(true);
    setError(null);
    try {
      const stocks = await fetchStockListFromFMP();
      setAllStocks(stocks);
      // Filters and search will be applied by their own useEffect
    } catch (err: any) {
      console.error("Failed to load initial stocks:", err);
      if (err instanceof FMPApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while fetching stocks. Please check your network connection or API key permissions.");
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, []);
  
  // Load filters and search from URL on initial mount
  useEffect(() => {
    console.log("[App component] useEffect for initial URL parsing and stock load."); // Diagnostic log
    if (window.location.protocol !== 'blob:') { // Check protocol here as well for reading params
        const params = new URLSearchParams(window.location.search);
        const filtersParam = params.get('filters');
        const searchParam = params.get('search');

        if (filtersParam) {
          try {
            const parsedFilters = JSON.parse(decodeURIComponent(filtersParam));
            setActiveFilters(parsedFilters);
          } catch (e) {
            console.error("Error parsing filters from URL", e);
          }
        }
        if (searchParam) {
          setSearchTerm(decodeURIComponent(searchParam));
        }
    } else {
        console.warn("[App component] Skipping URL parameter parsing for blob: protocol.");
    }
    loadInitialStocks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInitialStocks]); // Deliberately run only once on mount after loadInitialStocks is defined

  // Update URL when filters or search term change
  useEffect(() => {
    console.log("[App component] useEffect for URL update."); // Diagnostic log

    // Check if the current document URL is a blob URL to prevent SecurityError
    if (window.location.protocol === 'blob:') {
      console.warn("[App component] Skipping URL update for blob: protocol to prevent SecurityError.");
      return; // Do not attempt to modify history for blob URLs
    }

    const params = new URLSearchParams();
    if (Object.keys(activeFilters).length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(activeFilters)));
    }
    if (searchTerm.trim() !== '') {
      params.set('search', encodeURIComponent(searchTerm));
    }
    
    // Ensure pathname is not undefined or empty, which might happen in some environments
    const pathname = window.location.pathname || '/';
    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    
    try {
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.error("[App component] Error calling window.history.replaceState:", e);
      // Log the error but allow the app to continue functioning.
      // This might happen in restrictive iframe environments even if not a blob: URL.
    }
  }, [activeFilters, searchTerm]);


  const applyFiltersAndSearch = useCallback(() => {
    console.log("[App component] applyFiltersAndSearch called."); // Diagnostic log
    let tempStocks = [...allStocks];
    
    // Basic NLP for "large cap value" - very rudimentary
    if (searchTerm.toLowerCase().includes("large cap value")) {
      // Corrected: use peRatio for 'value' to match filter definitions
      setActiveFilters(prev => ({...prev, marketCap: 'large', peRatio: 'value' }));
    } // Add more NLP rules here if desired


    // Apply search
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempStocks = tempStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(lowerSearchTerm) ||
        stock.name.toLowerCase().includes(lowerSearchTerm) ||
        stock.sector.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Apply filters
    Object.entries(activeFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue) {
        tempStocks = tempStocks.filter(stock => {
          // Filter logic based on SubFilterGroupDef.id from constants.ts
          if (filterKey === 'marketCap') return stock.marketCapCategory === filterValue;
          if (filterKey === 'volume') return stock.volumeCategory === filterValue;
          
          if (filterKey === 'debtEquityRatio') return stock.debtCategory === filterValue; 
          if (filterKey === 'peRatio') return stock.valuationCategory === filterValue; 
          if (filterKey === 'roe') return stock.rotceCategory === filterValue; 
          
          if (filterKey === 'debtToEbitda') return stock.numericDebtEbitdaCategory === filterValue;
          if (filterKey === 'fcfToNetIncome') return stock.numericFcfNiCategory === filterValue;
          
          if (filterKey === 'shareCountChange') return stock.shareCountCagrCategory === filterValue;
          if (filterKey === 'evToEbit') return stock.numericEvEbitCategory === filterValue; 
          if (filterKey === 'priceToNCAV') return stock.deepValueCategory === filterValue;
          
          if (filterKey === 'moatKws') return stock.moatKeywordsCategory === filterValue;
          if (filterKey === 'insiderOwn') return stock.insiderOwnershipCategory === filterValue;
          if (filterKey === 'netInsiderTrx') return stock.netInsiderBuysCategory === filterValue;
          if (filterKey === 'gmTrend') return stock.grossMarginTrendCategory === filterValue;
          if (filterKey === 'incRoic') return stock.incrementalRoicCategory === filterValue;
          if (filterKey === 'rdFlags') return stock.redFlagsCategory === filterValue;

          if (filterKey === 'qualitativeAndCatalysts') { 
            if (filterValue === 'spinOff') { /* TODO: check stock.hasSpinOff */ return false; } 
            if (filterValue === 'selfTender') { /* TODO: check stock.hasSelfTender */ return false; }
            return true; 
          }
          
          if (filterKey === 'liquiditySafety') {
              // const sliderNumValue = Number(filterValue);
              // TODO: Implement actual filtering based on sliderNumValue
              return true; 
          }
          
          return true; 
        });
      }
    });

    setFilteredStocks(tempStocks);
    setStocksToDisplay(tempStocks.slice(0, STOCKS_PER_PAGE * currentPage)); 
  }, [allStocks, searchTerm, activeFilters, currentPage]);


  useEffect(() => {
    console.log("[App component] useEffect for applying filters/search."); // Diagnostic log
    applyFiltersAndSearch();
  }, [searchTerm, activeFilters, allStocks, applyFiltersAndSearch]);


  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || stocksToDisplay.length >= filteredStocks.length) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const nextStocks = filteredStocks.slice(0, nextPage * STOCKS_PER_PAGE);
    
    setTimeout(() => {
      setStocksToDisplay(nextStocks);
      setCurrentPage(nextPage);
      setIsLoadingMore(false);
    }, 500); 

  }, [currentPage, filteredStocks, isLoadingMore, stocksToDisplay.length]);

  useEffect(() => {
    const observerRefValue = mainContentRef.current; 
    if (!observerRefValue) return;
    
    const handleScroll = () => {
      if (
        observerRefValue.scrollHeight - observerRefValue.scrollTop <= observerRefValue.clientHeight + 200 &&
        !isLoadingMore &&
        stocksToDisplay.length < filteredStocks.length &&
        stocksToDisplay.length > 0
      ) {
        handleLoadMore();
      }
    };

    observerRefValue.addEventListener('scroll', handleScroll);
    return () => {
      if (observerRefValue) { 
        observerRefValue.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isLoadingMore, stocksToDisplay.length, filteredStocks.length, handleLoadMore, mainContentRef]);


  const handleFilterChange = (group: string, value: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[group] === value) {
        delete newFilters[group]; 
      } else {
        newFilters[group] = value; 
      }
      return newFilters;
    });
    setCurrentPage(1); // Reset to page 1 on filter change
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleRemoveFilter = (group: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[group];
      return newFilters;
    });
    setCurrentPage(1);
  };
  
  const handleApplyPreset = (filters: ActiveFilters) => {
    setActiveFilters(filters);
    setIsSidebarOpen(false); 
    setCurrentPage(1);
    if (isPresetWizardOpen) setIsPresetWizardOpen(false);
  };

  const handleOpenStockDetails = async (stock: Stock) => {
    setIsStockDetailsModalOpen(true);
    setIsLoadingStockDetails(true);
    setStockDetailsError(null);
    setSelectedStockDetails(null); 
    try {
      const details = await fetchStockDetailsFromFMP(stock.symbol);
      setSelectedStockDetails(details);
    } catch (err: any) {
      console.error("Failed to load stock details:", err);
      setStockDetailsError(err.message || "Failed to load stock details.");
    } finally {
      setIsLoadingStockDetails(false);
    }
  };
  
  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // Effect to handle body scroll when mobile sidebar is open/closed
  useEffect(() => {
    const isMobileView = () => window.innerWidth < 640; // Tailwind's 'sm' breakpoint

    if (isSidebarOpen && isMobileView()) {
      document.body.classList.add('overflow-hidden-body');
    } else {
      document.body.classList.remove('overflow-hidden-body');
    }
    // Cleanup function to remove class if component unmounts or dependencies change
    return () => {
      document.body.classList.remove('overflow-hidden-body');
    };
  }, [isSidebarOpen]);


  const handleSaveKeyMetricsVisibility = (newVisibility: KeyMetricVisibility) => {
    setKeyMetricsVisibility(newVisibility);
    setIsCustomizeMetricsModalOpen(false);
    localStorage.setItem('keyMetricsVisibility', JSON.stringify(newVisibility));
  };

  useEffect(() => {
    console.log("[App component] useEffect for key metrics visibility load."); // Diagnostic log
    const savedVisibility = localStorage.getItem('keyMetricsVisibility');
    if (savedVisibility) {
      try {
        const parsedVisibility = JSON.parse(savedVisibility);
        // You might want to validate parsedVisibility structure here
        setKeyMetricsVisibility(parsedVisibility);
      } catch (e) {
        console.error("Error parsing key metrics visibility from localStorage", e);
        setKeyMetricsVisibility(INITIAL_KEY_METRICS_VISIBILITY);
      }
    }
  }, []);
  
   const allToggleableMetrics = [
    ...DISPLAY_METRICS_CONFIG.filter(dm => !dm.alwaysVisible)
  ];
  
  // TODO: Alerts feature requires backend implementation.
  // TODO: Backtesting feature requires backend implementation.

  console.log("[App component] Rendering. isInitialLoading:", isInitialLoading, "Error:", error); // Diagnostic log
  return (
    <div className={`app-container theme-${theme}`}>
      <Header 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onRefreshData={loadInitialStocks} 
        onToggleWatchlistPane={() => setIsWatchlistPaneOpen(prev => !prev)}
      />
      <div className="flex items-center justify-between p-2 sm:hidden"> {/* Container for mobile buttons */}
        <button 
          className="mobile-filter-button" 
          onClick={handleToggleSidebar} 
          aria-label="Open filters" 
          aria-expanded={isSidebarOpen}
        >
          <FilterIcon className="w-5 h-5 mr-1" /> Filters
        </button>
        <button 
            onClick={() => setIsPresetWizardOpen(true)}
            className="p-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
            ✨ Guided Setup
        </button>
      </div>


      <div className="app-layout">
        <Sidebar
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearAllFilters={handleClearAllFilters}
          onApplyPreset={handleApplyPreset}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenPresetWizard={() => setIsPresetWizardOpen(true)}
        />

        <main className="main-content" ref={mainContentRef}>
          {error && (
            <div className="error-banner" role="alert">
              <p><strong>Error:</strong> {error}</p>
              <p>Please ensure your FMP API key is correctly configured in <code>index.html</code> (window.APP_CONFIG.FMP_API_KEY) or <code>process.env.API_KEY</code> and has the necessary permissions.</p>
              <button onClick={loadInitialStocks} className="error-retry-button">Retry</button>
            </div>
          )}
          {isInitialLoading && !error && (
             <div className="initial-loading-spinner">
                <div className="spinner"></div>
                <p>Loading financial data...</p>
            </div>
          )}
          {!isInitialLoading && !error && (
            <>
              <KeyMetricsSection 
                filteredStocks={filteredStocks} 
                keyMetricsVisibility={keyMetricsVisibility}
                onOpenCustomizeModal={() => setIsCustomizeMetricsModalOpen(true)}
              />
              <StocksSection
                stocksToDisplay={stocksToDisplay}
                currentView={currentView}
                onSetView={setCurrentView}
                keyMetricsVisibility={keyMetricsVisibility}
                onStockClick={handleOpenStockDetails}
                isLoadingMore={isLoadingMore}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                activeFilters={activeFilters}
                onRemoveFilter={handleRemoveFilter}
                hasMoreStocksToLoad={stocksToDisplay.length < filteredStocks.length}
                watchlist={watchlist}
                onToggleWatchlist={toggleWatchlist}
              />
            </>
          )}
        </main>
      </div>
      <CustomizeMetricsModal
        isOpen={isCustomizeMetricsModalOpen}
        onClose={() => setIsCustomizeMetricsModalOpen(false)}
        onApply={handleSaveKeyMetricsVisibility}
        currentVisibilityConfig={keyMetricsVisibility}
        displayMetricsConfig={allToggleableMetrics}
      />
      <StockDetailsModal
        isOpen={isStockDetailsModalOpen}
        onClose={() => setIsStockDetailsModalOpen(false)}
        stockDetails={selectedStockDetails}
        isLoading={isLoadingStockDetails}
        watchlist={watchlist}
        onToggleWatchlist={toggleWatchlist}
      />
      <PresetWizardModal
        isOpen={isPresetWizardOpen}
        onClose={() => setIsPresetWizardOpen(false)}
        onApplyPreset={handleApplyPreset}
      />
      <WatchlistPane
        isOpen={isWatchlistPaneOpen}
        onClose={() => setIsWatchlistPaneOpen(false)}
        watchlistSymbols={watchlist}
        allStocks={allStocks} // Pass all stocks to find details for watchlist items
        onStockClick={handleOpenStockDetails}
        onToggleWatchlist={toggleWatchlist}
      />
       {stockDetailsError && isStockDetailsModalOpen && ( 
            <div className="modal-overlay" style={{ display: 'flex' }}>
                <div className="modal-content-inner modal-content-bg">
                    <p className="text-red-500 text-center p-4">{stockDetailsError}</p>
                    <button 
                        onClick={() => { setIsStockDetailsModalOpen(false); setStockDetailsError(null);}} 
                        className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

console.log("[index.tsx] ReactDOM.createRoot call starting."); // Diagnostic log
try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("[index.tsx] ReactDOM.render completed."); // Diagnostic log
  } else {
    console.error("Root element #root not found in the DOM. React app cannot be mounted.");
    document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif;"><h1>Application Error</h1><p>Root HTML element not found. The application cannot start.</p></div>';
  }
} catch (e: any) { // Added :any type for e
  console.error("Uncaught error during initial React setup or render:", e);
  const body = document.body;
  if (body) {
    const escapeHtml = (unsafe: string): string => 
      unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const errorMessage = e && typeof e.message === 'string' ? e.message : String(e);
    const errorStack = e && typeof e.stack === 'string' ? e.stack : 'No stack trace available.';
    
    body.innerHTML = `<div style="padding: 20px; font-family: sans-serif;"><h1>Application Critical Error</h1><p>An unexpected error occurred that prevented the application from starting. Please check the console for details.</p><h2>Error Message:</h2><pre style="white-space: pre-wrap; background: #f0f0f0; padding: 10px; border: 1px solid #ccc;">${escapeHtml(errorMessage)}</pre><h2>Stack Trace:</h2><pre style="white-space: pre-wrap; background: #f0f0f0; padding: 10px; border: 1px solid #ccc;">${escapeHtml(errorStack)}</pre></div>`;
  }
}
console.log("[index.tsx] Module execution finished."); // Diagnostic log