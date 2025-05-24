/**
 * Stock Screener Render Functions
 * 
 * This file contains the missing renderCardView and renderTableView functions
 * that are required by paginatedApp.js
 */

/**
 * Render stocks in card view
 * @param {Array} stocks - Stocks to render
 */
function renderCardView(stocks) {
    const stockCardsContainer = document.getElementById('stock-cards-container');
    
    // Clear container
    stockCardsContainer.innerHTML = '';
    
    // If no stocks, show message
    if (!stocks || stocks.length === 0) {
        const noStocksMessage = document.createElement('div');
        noStocksMessage.className = 'no-stocks-message';
        noStocksMessage.textContent = 'No stocks found matching your criteria.';
        stockCardsContainer.appendChild(noStocksMessage);
        return;
    }
    
    // Create card for each stock
    stocks.forEach(stock => {
        const card = document.createElement('div');
        card.className = 'stock-card';
        
        // Add incomplete data class if needed
        if (!stock.price || !stock.marketCap || !stock.peRatio) {
            card.classList.add('incomplete-data');
        }
        
        // Create card header
        const header = document.createElement('div');
        header.className = 'stock-header';
        
        const symbol = document.createElement('div');
        symbol.className = 'stock-symbol';
        symbol.textContent = stock.symbol;
        
        const exchange = document.createElement('div');
        exchange.className = 'stock-exchange';
        exchange.textContent = stock.exchange || 'Unknown';
        
        header.appendChild(symbol);
        header.appendChild(exchange);
        
        // Create stock name
        const name = document.createElement('div');
        name.className = 'stock-name';
        name.textContent = stock.name || 'Unknown Company';
        
        // Create metrics
        const metrics = document.createElement('div');
        metrics.className = 'stock-metrics';
        
        // Price metric
        const priceMetric = createMetric('Price', stock.formattedPrice || 'N/A');
        
        // Market cap metric
        const marketCapMetric = createMetric('Market Cap', stock.formattedMarketCap || 'N/A');
        
        // P/E ratio metric
        const peRatioMetric = createMetric('P/E Ratio', stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A');
        
        // Dividend yield metric
        const dividendYieldMetric = createMetric(
            'Dividend Yield', 
            stock.dividendYield ? `${(stock.dividendYield * 100).toFixed(2)}%` : 'N/A'
        );
        
        // Add metrics to container
        metrics.appendChild(priceMetric);
        metrics.appendChild(marketCapMetric);
        metrics.appendChild(peRatioMetric);
        metrics.appendChild(dividendYieldMetric);
        
        // Assemble card
        card.appendChild(header);
        card.appendChild(name);
        card.appendChild(metrics);
        
        // Add card to container
        stockCardsContainer.appendChild(card);
    });
    
    // Show cards container, hide table container
    stockCardsContainer.style.display = 'grid';
    const stockTableContainer = document.getElementById('stock-table-container');
    if (stockTableContainer) {
        stockTableContainer.style.display = 'none';
    }
}

/**
 * Render stocks in table view
 * @param {Array} stocks - Stocks to render
 */
function renderTableView(stocks) {
    const stockTableContainer = document.getElementById('stock-table-container');
    
    // Clear container
    stockTableContainer.innerHTML = '';
    
    // If no stocks, show message
    if (!stocks || stocks.length === 0) {
        const noStocksMessage = document.createElement('div');
        noStocksMessage.className = 'no-stocks-message';
        noStocksMessage.textContent = 'No stocks found matching your criteria.';
        stockTableContainer.appendChild(noStocksMessage);
        return;
    }
    
    // Create table
    const table = document.createElement('table');
    table.className = 'stock-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Define columns
    const columns = [
        { id: 'symbol', label: 'Symbol' },
        { id: 'exchange', label: 'Exchange' },
        { id: 'name', label: 'Name' },
        { id: 'price', label: 'Price' },
        { id: 'marketCap', label: 'Market Cap' },
        { id: 'peRatio', label: 'P/E Ratio' },
        { id: 'dividendYield', label: 'Dividend Yield' }
    ];
    
    // Create header cells
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column.label;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Create rows for each stock
    stocks.forEach(stock => {
        const row = document.createElement('tr');
        
        // Add incomplete data class if needed
        if (!stock.price || !stock.marketCap || !stock.peRatio) {
            row.classList.add('incomplete-data');
        }
        
        // Create cells for each column
        columns.forEach(column => {
            const td = document.createElement('td');
            
            switch (column.id) {
                case 'symbol':
                    td.textContent = stock.symbol;
                    break;
                case 'exchange':
                    td.textContent = stock.exchange || 'Unknown';
                    break;
                case 'name':
                    td.textContent = stock.name || 'Unknown Company';
                    break;
                case 'price':
                    td.textContent = stock.formattedPrice || 'N/A';
                    break;
                case 'marketCap':
                    td.textContent = stock.formattedMarketCap || 'N/A';
                    break;
                case 'peRatio':
                    td.textContent = stock.peRatio ? stock.peRatio.toFixed(2) : 'N/A';
                    break;
                case 'dividendYield':
                    td.textContent = stock.dividendYield ? `${(stock.dividendYield * 100).toFixed(2)}%` : 'N/A';
                    break;
                default:
                    td.textContent = 'N/A';
            }
            
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    stockTableContainer.appendChild(table);
    
    // Show table container, hide cards container
    stockTableContainer.style.display = 'block';
    const stockCardsContainer = document.getElementById('stock-cards-container');
    if (stockCardsContainer) {
        stockCardsContainer.style.display = 'none';
    }
}

/**
 * Create a metric element
 * @param {String} label - Metric label
 * @param {String} value - Metric value
 * @returns {HTMLElement} Metric element
 */
function createMetric(label, value) {
    const metric = document.createElement('div');
    metric.className = 'metric';
    
    const metricLabel = document.createElement('div');
    metricLabel.className = 'metric-label';
    metricLabel.textContent = label;
    
    const metricValue = document.createElement('div');
    metricValue.className = 'metric-value';
    metricValue.textContent = value;
    
    metric.appendChild(metricLabel);
    metric.appendChild(metricValue);
    
    return metric;
}

/**
 * Format currency value
 * @param {Number} value - Value to format
 * @returns {String} Formatted currency
 */
function formatCurrency(value) {
    if (value === undefined || value === null) return 'N/A';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Format large number with suffix (K, M, B, T)
 * @param {Number} value - Value to format
 * @returns {String} Formatted number
 */
function formatLargeNumber(value) {
    if (value === undefined || value === null) return 'N/A';
    
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
}

// Additional helper functions for stock rendering
function handlePageChange(page, pageSize) {
    loadStocksPage(page, pageSize);
}

function switchView(view) {
    currentView = view;
    
    // Update active state of view buttons
    if (cardViewButton && tableViewButton) {
        if (view === 'card') {
            cardViewButton.classList.add('active');
            tableViewButton.classList.remove('active');
        } else {
            cardViewButton.classList.remove('active');
            tableViewButton.classList.add('active');
        }
    }
    
    // Re-render stocks with current view
    renderStocks(currentStocks);
}

function toggleFilters() {
    filtersContent.classList.toggle('collapsed');
    filtersToggle.querySelector('.filters-toggle').classList.toggle('collapsed');
}

function handleResize() {
    // Re-render stocks to adjust card heights
    if (currentView === 'card') {
        renderStocks(currentStocks);
    }
}

function setLoading(loading) {
    isLoading = loading;
    
    // Update loading UI
    const loadingProgressBar = document.querySelector('.loading-progress-bar');
    const loadingProgressText = document.querySelector('.loading-progress-text');
    
    if (loadingProgressBar && loadingProgressText) {
        if (loading) {
            loadingProgressBar.style.display = 'block';
            loadingProgressText.style.display = 'block';
            
            // Animate progress bar
            const progressInner = loadingProgressBar.querySelector('.progress-inner');
            if (progressInner) {
                progressInner.style.width = '0%';
                setTimeout(() => {
                    progressInner.style.width = '70%';
                }, 100);
            }
        } else {
            // Complete progress animation
            const progressInner = loadingProgressBar.querySelector('.progress-inner');
            if (progressInner) {
                progressInner.style.width = '100%';
            }
            
            // Hide loading UI after animation
            setTimeout(() => {
                loadingProgressBar.style.display = 'none';
                loadingProgressText.style.display = 'none';
            }, 300);
        }
    }
}

function updateApiStatus(connected) {
    if (apiStatusIndicator && apiStatusText) {
        if (connected) {
            apiStatusIndicator.classList.remove('disconnected');
            apiStatusIndicator.classList.add('connected');
            apiStatusText.textContent = 'connected';
        } else {
            apiStatusIndicator.classList.remove('connected');
            apiStatusIndicator.classList.add('disconnected');
            apiStatusText.textContent = 'disconnected';
        }
    }
}

function updateStats(stats) {
    if (totalStocksElement) {
        totalStocksElement.textContent = stats.total.toLocaleString();
    }
    
    if (nyseStocksElement) {
        nyseStocksElement.textContent = stats.nyse.toLocaleString();
    }
    
    if (nasdaqStocksElement) {
        nasdaqStocksElement.textContent = stats.nasdaq.toLocaleString();
    }
    
    if (lastUpdatedElement && stats.lastUpdated) {
        const date = new Date(stats.lastUpdated);
        lastUpdatedElement.textContent = `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}