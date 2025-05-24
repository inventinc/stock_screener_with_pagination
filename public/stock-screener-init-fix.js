/**
 * Stock Screener Initialization Fix
 * 
 * This script ensures proper initialization of the stock data manager
 * and connects it to the rendering pipeline.
 */

// Execute immediately when loaded
(function() {
    console.log('Stock Screener Initialization Fix: Starting...');
    
    // Function to initialize the application
    function initializeStockScreener() {
        console.log('Stock Screener Initialization Fix: Initializing application...');
        
        // Check if we already have a data manager
        if (window.stockDataManager) {
            console.log('Stock Screener Initialization Fix: Data manager already exists');
            return;
        }
        
        // Get current protocol and host for API endpoint
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.host;
        const apiEndpoint = `${currentProtocol}//${currentHost}/api/stocks`;
        
        console.log('Stock Screener Initialization Fix: Using API endpoint:', apiEndpoint);
        
        // Create data manager
        try {
            // First try to use EnhancedDataManager if it exists
            if (typeof window.EnhancedDataManager === 'function') {
                console.log('Stock Screener Initialization Fix: Creating EnhancedDataManager');
                
                window.stockDataManager = new window.EnhancedDataManager({
                    apiEndpoint: apiEndpoint,
                    pageSize: 50,
                    useCache: false,
                    progressCallback: function(loaded, total, fromCache) {
                        console.log(`Loading progress: ${loaded}/${total} stocks`);
                        updateLoadingProgress(loaded, total, fromCache);
                    },
                    completeCallback: function(stocks, paginationInfo) {
                        console.log(`Data loading complete: ${stocks.length} stocks loaded`);
                        onDataLoadComplete(stocks, paginationInfo);
                    }
                });
            } 
            // If no EnhancedDataManager, create a basic data manager
            else {
                console.log('Stock Screener Initialization Fix: Creating basic data manager');
                
                // Simple data manager implementation
                window.stockDataManager = {
                    apiEndpoint: apiEndpoint,
                    stocks: [],
                    totalStocks: 0,
                    currentPage: 1,
                    pageSize: 50,
                    isLoading: false,
                    
                    loadPage: function(page, filters) {
                        if (this.isLoading) return Promise.resolve();
                        this.isLoading = true;
                        
                        // Show loading state
                        updateLoadingProgress(0, 1, false);
                        
                        // Build query parameters
                        const queryParams = new URLSearchParams();
                        queryParams.append('page', page);
                        queryParams.append('pageSize', this.pageSize);
                        
                        // Add filters if provided
                        if (filters) {
                            Object.entries(filters).forEach(([key, value]) => {
                                if (Array.isArray(value)) {
                                    value.forEach(v => queryParams.append(key, v));
                                } else if (value) {
                                    queryParams.append(key, value);
                                }
                            });
                        }
                        
                        // Build URL
                        const url = `${this.apiEndpoint}?${queryParams.toString()}`;
                        console.log(`Loading page ${page} from: ${url}`);
                        
                        // Fetch data
                        return fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error ${response.status}`);
                                }
                                return response.json();
                            })
                            .then(data => {
                                // Update state
                                this.stocks = data.stocks || [];
                                this.totalStocks = data.pagination?.total || 0;
                                this.currentPage = data.pagination?.page || page;
                                this.totalPages = data.pagination?.pages || Math.ceil(this.totalStocks / this.pageSize);
                                
                                // Store stats
                                if (data.stats) {
                                    this.stats = data.stats;
                                }
                                
                                console.log(`Page ${page} loaded: ${this.stocks.length} stocks of ${this.totalStocks} total`);
                                
                                // Report progress
                                updateLoadingProgress(1, 1, false);
                                
                                // Call complete callback
                                onDataLoadComplete(this.stocks, {
                                    currentPage: this.currentPage,
                                    totalPages: this.totalPages,
                                    totalStocks: this.totalStocks
                                });
                                
                                this.isLoading = false;
                                return this.stocks;
                            })
                            .catch(error => {
                                console.error('Error loading page:', error);
                                this.isLoading = false;
                                throw error;
                            });
                    },
                    
                    getCurrentPageStocks: function() {
                        return this.stocks;
                    }
                };
            }
            
            // Ensure the loading progress and completion functions exist
            if (typeof window.updateLoadingProgress !== 'function') {
                window.updateLoadingProgress = function(loaded, total, fromCache) {
                    // Update progress bar
                    const progressBar = document.getElementById('loading-progress-bar');
                    const progressInner = progressBar?.querySelector('.progress-inner');
                    const progressText = document.getElementById('loading-progress-text');
                    
                    if (progressBar && progressInner && progressText) {
                        const percent = Math.min(100, Math.round((loaded / total) * 100));
                        
                        progressBar.style.display = 'block';
                        progressInner.style.width = `${percent}%`;
                        
                        progressText.style.display = 'block';
                        progressText.textContent = fromCache ? 
                            `Loaded stocks from cache` : 
                            `Loading stocks...`;
                    }
                    
                    // Update connection status
                    const statusIndicator = document.getElementById('api-status-indicator');
                    const statusText = document.getElementById('api-status-text');
                    
                    if (statusIndicator && statusText) {
                        statusIndicator.classList.remove('disconnected');
                        statusIndicator.classList.add('connected');
                        statusText.textContent = 'connected';
                    }
                };
            }
            
            if (typeof window.onDataLoadComplete !== 'function') {
                window.onDataLoadComplete = function(stocks, paginationInfo) {
                    console.log(`Data loading complete: ${stocks.length} stocks loaded`);
                    
                    // Hide loading indicators
                    const progressBar = document.getElementById('loading-progress-bar');
                    const progressText = document.getElementById('loading-progress-text');
                    
                    if (progressBar) progressBar.style.display = 'none';
                    if (progressText) progressText.style.display = 'none';
                    
                    // Update stats
                    updateStats(stocks, paginationInfo);
                    
                    // Render stocks
                    renderStocks(stocks);
                    
                    // Update pagination if available
                    if (window.StockPagination && paginationInfo) {
                        updatePagination(paginationInfo);
                    }
                };
            }
            
            // Ensure the rendering functions exist
            if (typeof window.renderStocks !== 'function') {
                window.renderStocks = function(stocks) {
                    console.log(`Rendering ${stocks.length} stocks`);
                    
                    // Determine active view
                    const activeView = document.querySelector('.view-button.active')?.dataset?.view || 'cards';
                    
                    // Render appropriate view
                    if (activeView === 'cards') {
                        renderCardView(stocks);
                    } else {
                        renderTableView(stocks);
                    }
                };
            }
            
            // Ensure the card view rendering function exists
            if (typeof window.renderCardView !== 'function') {
                window.renderCardView = function(stocks) {
                    const container = document.getElementById('stock-cards-container');
                    if (!container) return;
                    
                    // Clear container
                    container.innerHTML = '';
                    
                    // Show empty state if no stocks
                    if (!stocks || stocks.length === 0) {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">📊</div>
                                <div class="empty-title">No stocks found</div>
                                <div class="empty-message">Try adjusting your filters or search criteria</div>
                            </div>
                        `;
                        return;
                    }
                    
                    // Render each stock card
                    stocks.forEach(stock => {
                        const card = document.createElement('div');
                        card.className = 'stock-card';
                        
                        // Format values
                        const formattedPrice = formatCurrency(stock.price);
                        const formattedMarketCap = formatLargeNumber(stock.marketCap);
                        const formattedPE = stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A';
                        const formattedDividend = stock.dividendYield ? 
                            (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A';
                        const formattedDebt = stock.netDebtToEBITDA ? 
                            stock.netDebtToEBITDA.toFixed(2) + 'x' : 'N/A';
                        
                        // Create card content
                        card.innerHTML = `
                            <div class="stock-header">
                                <div class="stock-symbol">${stock.symbol}</div>
                                <div class="stock-exchange">${stock.exchange || 'N/A'}</div>
                            </div>
                            <div class="stock-name">${stock.name || 'Unknown'}</div>
                            <div class="stock-metrics">
                                <div class="metric">
                                    <div class="metric-label">Price</div>
                                    <div class="metric-value">${formattedPrice}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Market Cap</div>
                                    <div class="metric-value">${formattedMarketCap}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">P/E Ratio</div>
                                    <div class="metric-value">${formattedPE}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Dividend Yield</div>
                                    <div class="metric-value">${formattedDividend}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Debt/EBITDA</div>
                                    <div class="metric-value">${formattedDebt}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Score</div>
                                    <div class="metric-value">${renderScore(stock.score)}</div>
                                </div>
                            </div>
                        `;
                        
                        container.appendChild(card);
                    });
                };
            }
            
            // Ensure the table view rendering function exists
            if (typeof window.renderTableView !== 'function') {
                window.renderTableView = function(stocks) {
                    const container = document.getElementById('stock-table-container');
                    if (!container) return;
                    
                    // Clear container
                    container.innerHTML = '';
                    
                    // Show empty state if no stocks
                    if (!stocks || stocks.length === 0) {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">📊</div>
                                <div class="empty-title">No stocks found</div>
                                <div class="empty-message">Try adjusting your filters or search criteria</div>
                            </div>
                        `;
                        return;
                    }
                    
                    // Create table
                    const table = document.createElement('table');
                    table.className = 'stock-table';
                    
                    // Create header
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    
                    // Define columns
                    const columns = [
                        { field: 'symbol', label: 'Symbol' },
                        { field: 'name', label: 'Name' },
                        { field: 'exchange', label: 'Exchange' },
                        { field: 'price', label: 'Price' },
                        { field: 'marketCap', label: 'Market Cap' },
                        { field: 'peRatio', label: 'P/E Ratio' },
                        { field: 'dividendYield', label: 'Div Yield' },
                        { field: 'netDebtToEBITDA', label: 'Debt/EBITDA' },
                        { field: 'score', label: 'Score' }
                    ];
                    
                    // Create header cells
                    columns.forEach(column => {
                        const th = document.createElement('th');
                        th.textContent = column.label;
                        headerRow.appendChild(th);
                    });
                    
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    // Create body
                    const tbody = document.createElement('tbody');
                    
                    // Create rows
                    stocks.forEach(stock => {
                        const row = document.createElement('tr');
                        
                        // Add cells
                        columns.forEach(column => {
                            const cell = document.createElement('td');
                            
                            // Get value
                            let value = stock[column.field];
                            
                            // Format value
                            if (column.field === 'symbol') {
                                cell.innerHTML = `<span class="stock-symbol-cell">${value}</span>`;
                            } else if (column.field === 'price') {
                                cell.textContent = formatCurrency(value) || 'N/A';
                            } else if (column.field === 'marketCap') {
                                cell.textContent = formatLargeNumber(value) || 'N/A';
                            } else if (column.field === 'peRatio') {
                                cell.textContent = value ? value.toFixed(2) : 'N/A';
                            } else if (column.field === 'dividendYield') {
                                cell.textContent = value ? (value * 100).toFixed(2) + '%' : 'N/A';
                            } else if (column.field === 'netDebtToEBITDA') {
                                cell.textContent = value ? value.toFixed(2) + 'x' : 'N/A';
                            } else if (column.field === 'score') {
                                cell.innerHTML = renderScore(value);
                            } else {
                                cell.textContent = value || 'N/A';
                            }
                            
                            row.appendChild(cell);
                        });
                        
                        tbody.appendChild(row);
                    });
                    
                    table.appendChild(tbody);
                    container.appendChild(table);
                };
            }
            
            // Ensure the stats update function exists
            if (typeof window.updateStats !== 'function') {
                window.updateStats = function(stocks, paginationInfo) {
                    // Update total stocks
                    const totalStocksEl = document.getElementById('total-stocks');
                    if (totalStocksEl) {
                        totalStocksEl.textContent = formatNumber(paginationInfo?.totalStocks || stocks.length);
                    }
                    
                    // Update NYSE stocks
                    const nyseStocksEl = document.getElementById('nyse-stocks');
                    if (nyseStocksEl && window.stockDataManager.stats) {
                        nyseStocksEl.textContent = formatNumber(window.stockDataManager.stats.nyse || 0);
                    }
                    
                    // Update NASDAQ stocks
                    const nasdaqStocksEl = document.getElementById('nasdaq-stocks');
                    if (nasdaqStocksEl && window.stockDataManager.stats) {
                        nasdaqStocksEl.textContent = formatNumber(window.stockDataManager.stats.nasdaq || 0);
                    }
                    
                    // Update last updated
                    const lastUpdatedEl = document.getElementById('last-updated');
                    if (lastUpdatedEl && window.stockDataManager.stats?.lastUpdated) {
                        const date = new Date(window.stockDataManager.stats.lastUpdated);
                        lastUpdatedEl.textContent = date.toLocaleString();
                    }
                };
            }
            
            // Ensure the pagination update function exists
            if (typeof window.updatePagination !== 'function') {
                window.updatePagination = function(paginationInfo) {
                    const container = document.getElementById('pagination-container');
                    if (!container || !window.StockPagination) return;
                    
                    // Clear container
                    container.innerHTML = '';
                    
                    // Create pagination
                    window.StockPagination.createPagination({
                        container: container,
                        currentPage: paginationInfo.currentPage,
                        totalPages: paginationInfo.totalPages,
                        onPageChange: function(page) {
                            if (window.stockDataManager) {
                                window.stockDataManager.loadPage(page);
                            }
                        }
                    });
                };
            }
            
            // Ensure the score rendering function exists
            if (typeof window.renderScore !== 'function') {
                window.renderScore = function(score) {
                    if (!score && score !== 0) return 'N/A';
                    
                    let scoreClass = '';
                    if (score >= 80) scoreClass = 'excellent';
                    else if (score >= 60) scoreClass = 'good';
                    else if (score >= 40) scoreClass = 'average';
                    else if (score >= 20) scoreClass = 'below-average';
                    else scoreClass = 'poor';
                    
                    return `<span class="score ${scoreClass}">${score}</span>`;
                };
            }
            
            // Ensure the formatting functions exist
            if (typeof window.formatCurrency !== 'function') {
                window.formatCurrency = function(value) {
                    if (value === null || value === undefined) return 'N/A';
                    
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value);
                };
            }
            
            if (typeof window.formatLargeNumber !== 'function') {
                window.formatLargeNumber = function(value) {
                    if (value === null || value === undefined) return 'N/A';
                    
                    if (value >= 1e12) {
                        return '$' + (value / 1e12).toFixed(2) + 'T';
                    } else if (value >= 1e9) {
                        return '$' + (value / 1e9).toFixed(2) + 'B';
                    } else if (value >= 1e6) {
                        return '$' + (value / 1e6).toFixed(2) + 'M';
                    } else if (value >= 1e3) {
                        return '$' + (value / 1e3).toFixed(2) + 'K';
                    } else {
                        return '$' + value.toFixed(2);
                    }
                };
            }
            
            if (typeof window.formatNumber !== 'function') {
                window.formatNumber = function(value) {
                    return new Intl.NumberFormat('en-US').format(value);
                };
            }
            
            // Start loading data
            console.log('Stock Screener Initialization Fix: Loading initial data...');
            window.stockDataManager.loadPage(1);
            
            // Set up filter buttons
            setupFilterButtons();
            
            // Set up view buttons
            setupViewButtons();
            
            console.log('Stock Screener Initialization Fix: Initialization complete');
        } catch (error) {
            console.error('Stock Screener Initialization Fix: Error initializing application:', error);
        }
    }
    
    // Set up filter buttons
    function setupFilterButtons() {
        // Get all filter buttons
        const filterButtons = document.querySelectorAll('.filter-button[data-filter]');
        
        // Initialize active filters object if it doesn't exist
        if (!window.activeFilters) {
            window.activeFilters = {};
        }
        
        // Add click event listeners
        filterButtons.forEach(button => {
            // Skip if already initialized
            if (button.dataset.initialized === 'true') return;
            
            button.addEventListener('click', function() {
                const filter = this.dataset.filter;
                const value = this.dataset.value;
                
                // Toggle active state
                this.classList.toggle('active');
                
                // Initialize filter array if it doesn't exist
                if (!window.activeFilters[filter]) {
                    window.activeFilters[filter] = [];
                }
                
                // Update active filters
                if (this.classList.contains('active')) {
                    // Add filter
                    if (!window.activeFilters[filter].includes(value)) {
                        window.activeFilters[filter].push(value);
                    }
                } else {
                    // Remove filter
                    window.activeFilters[filter] = window.activeFilters[filter].filter(v => v !== value);
                    
                    // Remove empty filter
                    if (window.activeFilters[filter].length === 0) {
                        delete window.activeFilters[filter];
                    }
                }
                
                // Reload data with filters
                if (window.stockDataManager) {
                    window.stockDataManager.loadPage(1, window.activeFilters);
                }
            });
            
            // Mark as initialized
            button.dataset.initialized = 'true';
        });
        
        // Set up preset buttons
        const presetButtons = document.querySelectorAll('.preset-button');
        
        presetButtons.forEach(button => {
            // Skip if already initialized
            if (button.dataset.initialized === 'true') return;
            
            button.addEventListener('click', function() {
                const preset = this.dataset.preset;
                
                // Toggle active state
                const wasActive = this.classList.contains('active');
                
                // Clear all preset selections
                document.querySelectorAll('.preset-button').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Clear all filters
                document.querySelectorAll('.filter-button').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Reset active filters
                window.activeFilters = {};
                
                // Apply preset if it wasn't already active
                if (!wasActive) {
                    this.classList.add('active');
                    window.activeFilters.preset = preset;
                }
                
                // Reload data with filters
                if (window.stockDataManager) {
                    window.stockDataManager.loadPage(1, window.activeFilters);
                }
            });
            
            // Mark as initialized
            button.dataset.initialized = 'true';
        });
        
        // Set up reset button
        const resetButton = document.getElementById('reset-filters-btn');
        
        if (resetButton && resetButton.dataset.initialized !== 'true') {
            resetButton.addEventListener('click', function() {
                // Clear all selections
                document.querySelectorAll('.filter-button, .preset-button').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Reset active filters
                window.activeFilters = {};
                
                // Reload data without filters
                if (window.stockDataManager) {
                    window.stockDataManager.loadPage(1);
                }
            });
            
            // Mark as initialized
            resetButton.dataset.initialized = 'true';
        }
        
        // Set up search input
        const searchInput = document.getElementById('search-input');
        
        if (searchInput && searchInput.dataset.initialized !== 'true') {
            searchInput.addEventListener('input', function() {
                // Debounce search
                clearTimeout(searchInput.searchTimeout);
                
                searchInput.searchTimeout = setTimeout(function() {
                    const searchValue = searchInput.value.trim();
                    
                    // Update active filters
                    if (searchValue) {
                        window.activeFilters.search = searchValue;
                    } else {
                        delete window.activeFilters.search;
                    }
                    
                    // Reload data with filters
                    if (window.stockDataManager) {
                        window.stockDataManager.loadPage(1, window.activeFilters);
                    }
                }, 300);
            });
            
            // Mark as initialized
            searchInput.dataset.initialized = 'true';
        }
    }
    
    // Set up view buttons
    function setupViewButtons() {
        // Get view buttons
        const viewButtons = document.querySelectorAll('.view-button[data-view]');
        
        // Add click event listeners
        viewButtons.forEach(button => {
            // Skip if already initialized
            if (button.dataset.initialized === 'true') return;
            
            button.addEventListener('click', function() {
                const view = this.dataset.view;
                
                // Update active state
                viewButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Show/hide containers
                const cardsContainer = document.getElementById('stock-cards-container');
                const tableContainer = document.getElementById('stock-table-container');
                
                if (cardsContainer) {
                    cardsContainer.style.display = view === 'cards' ? 'grid' : 'none';
                }
                
                if (tableContainer) {
                    tableContainer.style.display = view === 'table' ? 'block' : 'none';
                }
                
                // Re-render current stocks
                if (window.stockDataManager) {
                    const stocks = window.stockDataManager.getCurrentPageStocks();
                    if (stocks && stocks.length) {
                        renderStocks(stocks);
                    }
                }
            });
            
            // Mark as initialized
            button.dataset.initialized = 'true';
        });
    }
    
    // Wait for DOM to be loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeStockScreener);
    } else {
        // DOM already loaded, initialize immediately
        initializeStockScreener();
    }
    
    // Also initialize when window is fully loaded
    window.addEventListener('load', function() {
        // Wait a moment to ensure all scripts are loaded
        setTimeout(initializeStockScreener, 500);
    });
    
    console.log('Stock Screener Initialization Fix: Setup complete');
})();
