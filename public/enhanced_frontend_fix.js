/**
 * Enhanced frontend fix for Stock Screener application
 * This script fixes the UI display issue and improves search field placement
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("Enhanced frontend fix loaded - initializing stock data display");
    
    // Track connection status
    let isConnected = false;
    let stockData = [];
    
    // DOM elements
    const stockCardsContainer = document.getElementById('stock-cards-container');
    const searchInput = document.getElementById('search-input');
    const viewControlsSection = document.querySelector('.view-controls');
    const connectionStatusElement = document.querySelector('.connection-status') || 
                                   createConnectionStatusElement();
    
    // Create connection status indicator if it doesn't exist
    function createConnectionStatusElement() {
        const element = document.createElement('div');
        element.className = 'connection-status';
        element.style.position = 'fixed';
        element.style.top = '10px';
        element.style.right = '10px';
        element.style.padding = '5px 10px';
        element.style.borderRadius = '4px';
        element.style.fontSize = '12px';
        element.style.zIndex = '1000';
        document.body.appendChild(element);
        return element;
    }
    
    // Update connection status display
    function updateConnectionStatus(status) {
        isConnected = status === 'connected';
        
        if (isConnected) {
            connectionStatusElement.textContent = '🟢 connected';
            connectionStatusElement.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        } else {
            connectionStatusElement.textContent = '🔴 disconnected';
            connectionStatusElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        }
        connectionStatusElement.style.color = 'white';
    }
    
    // Improve search field placement
    function improveSearchFieldPlacement() {
        if (!searchInput || !viewControlsSection) return;
        
        // Remove existing search container
        const existingSearchContainer = searchInput.parentElement;
        if (existingSearchContainer && existingSearchContainer.classList.contains('search-container')) {
            existingSearchContainer.remove();
        }
        
        // Create enhanced search container
        const enhancedSearchContainer = document.createElement('div');
        enhancedSearchContainer.className = 'enhanced-search-container';
        enhancedSearchContainer.style.position = 'relative';
        enhancedSearchContainer.style.margin = '20px auto';
        enhancedSearchContainer.style.maxWidth = '600px';
        enhancedSearchContainer.style.width = '100%';
        enhancedSearchContainer.style.display = 'flex';
        enhancedSearchContainer.style.alignItems = 'center';
        enhancedSearchContainer.style.justifyContent = 'center';
        enhancedSearchContainer.style.zIndex = '100';
        
        // Create new search input with improved styling
        const newSearchInput = document.createElement('input');
        newSearchInput.id = 'search-input';
        newSearchInput.className = 'search-input';
        newSearchInput.type = 'text';
        newSearchInput.placeholder = 'Search by symbol or name...';
        newSearchInput.style.width = '100%';
        newSearchInput.style.padding = '10px 40px 10px 15px';
        newSearchInput.style.fontSize = '16px';
        newSearchInput.style.border = '2px solid #ddd';
        newSearchInput.style.borderRadius = '25px';
        newSearchInput.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        newSearchInput.style.transition = 'all 0.3s ease';
        
        // Add focus effect
        newSearchInput.addEventListener('focus', () => {
            newSearchInput.style.borderColor = '#0066ff';
            newSearchInput.style.boxShadow = '0 2px 8px rgba(0,102,255,0.3)';
        });
        
        newSearchInput.addEventListener('blur', () => {
            newSearchInput.style.borderColor = '#ddd';
            newSearchInput.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        });
        
        // Add search icon
        const searchIcon = document.createElement('div');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = '🔍';
        searchIcon.style.position = 'absolute';
        searchIcon.style.right = '15px';
        searchIcon.style.top = '50%';
        searchIcon.style.transform = 'translateY(-50%)';
        searchIcon.style.fontSize = '16px';
        searchIcon.style.color = '#666';
        searchIcon.style.cursor = 'pointer';
        
        // Add clear button
        const clearButton = document.createElement('div');
        clearButton.className = 'clear-search';
        clearButton.innerHTML = '✕';
        clearButton.style.position = 'absolute';
        clearButton.style.right = '40px';
        clearButton.style.top = '50%';
        clearButton.style.transform = 'translateY(-50%)';
        clearButton.style.fontSize = '14px';
        clearButton.style.color = '#999';
        clearButton.style.cursor = 'pointer';
        clearButton.style.display = 'none';
        clearButton.style.zIndex = '101';
        
        clearButton.addEventListener('click', () => {
            newSearchInput.value = '';
            clearButton.style.display = 'none';
            applyFilters();
            newSearchInput.focus();
        });
        
        // Show/hide clear button based on input
        newSearchInput.addEventListener('input', () => {
            clearButton.style.display = newSearchInput.value ? 'block' : 'none';
            applyFilters();
        });
        
        // Add elements to container
        enhancedSearchContainer.appendChild(newSearchInput);
        enhancedSearchContainer.appendChild(searchIcon);
        enhancedSearchContainer.appendChild(clearButton);
        
        // Insert the enhanced search container before the stocks section
        const stocksSection = document.querySelector('.stocks-section');
        if (stocksSection && stocksSection.parentNode) {
            stocksSection.parentNode.insertBefore(enhancedSearchContainer, stocksSection);
        }
        
        // Update reference to the new search input
        return newSearchInput;
    }
    
    // Check connection status and load stocks
    async function checkConnectionAndLoadStocks() {
        try {
            // First check status
            const statusResponse = await fetch('/api/status');
            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
            }
            
            const statusData = await statusResponse.json();
            console.log("Status check:", statusData);
            
            // Update connection status based on API response
            updateConnectionStatus(statusData.database);
            
            // If connected, load stocks
            if (statusData.database === 'connected') {
                const stocksResponse = await fetch('/api/stocks');
                if (!stocksResponse.ok) {
                    throw new Error(`Stocks fetch failed: ${stocksResponse.status}`);
                }
                
                const stocksData = await stocksResponse.json();
                console.log(`Loaded ${stocksData.stocks.length} of ${stocksData.total} stocks`);
                
                // Store stock data and update UI
                stockData = stocksData.stocks;
                updateStockDisplay();
                
                // Update stats display
                updateStatsDisplay(stocksData.total);
            }
        } catch (error) {
            console.error("Connection check error:", error);
            updateConnectionStatus('disconnected');
        }
    }
    
    // Apply filters based on search input and active filters
    function applyFilters() {
        const searchValue = document.getElementById('search-input')?.value.toLowerCase() || '';
        
        // Get all stock cards
        const stockCards = document.querySelectorAll('.stock-card');
        
        stockCards.forEach(card => {
            const symbol = card.querySelector('.stock-symbol')?.textContent.toLowerCase() || '';
            const name = card.querySelector('.stock-name')?.textContent.toLowerCase() || '';
            
            // Check if card matches search
            const matchesSearch = !searchValue || 
                                 symbol.includes(searchValue) || 
                                 name.includes(searchValue);
            
            // Show/hide card based on filters
            card.style.display = matchesSearch ? 'block' : 'none';
        });
        
        // Update count of visible stocks
        const visibleCount = Array.from(stockCards).filter(card => card.style.display !== 'none').length;
        console.log(`Showing ${visibleCount} of ${stockCards.length} stocks after filtering`);
    }
    
    // Update the stock cards display
    function updateStockDisplay() {
        if (!stockCardsContainer) return;
        
        // Clear existing content
        stockCardsContainer.innerHTML = '';
        
        if (!isConnected || stockData.length === 0) {
            const message = document.createElement('div');
            message.className = 'no-stocks-message';
            message.textContent = isConnected 
                ? 'No stocks match your criteria' 
                : 'Cannot load stocks - please check connection';
            message.style.padding = '20px';
            message.style.textAlign = 'center';
            message.style.color = '#666';
            stockCardsContainer.appendChild(message);
            return;
        }
        
        // Create stock cards
        stockData.forEach(stock => {
            const card = createStockCard(stock);
            stockCardsContainer.appendChild(card);
        });
        
        // Apply any existing filters
        applyFilters();
    }
    
    // Create a stock card element
    function createStockCard(stock) {
        const card = document.createElement('div');
        card.className = 'stock-card';
        
        // Format market cap
        const marketCap = formatMarketCap(stock.marketCap);
        
        // Calculate score class
        const scoreClass = getScoreClass(stock.score);
        
        card.innerHTML = `
            <div class="stock-header">
                <span class="stock-symbol">${stock.symbol}</span>
                <span class="stock-exchange">${stock.exchange || 'N/A'}</span>
            </div>
            <div class="stock-name">${stock.name || 'Unknown'}</div>
            <div class="stock-metrics">
                <div class="metric">
                    <div class="metric-label">Price</div>
                    <div class="metric-value">$${(stock.price || 0).toFixed(2)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Market Cap</div>
                    <div class="metric-value">${marketCap}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">P/E Ratio</div>
                    <div class="metric-value">${(stock.peRatio || 0).toFixed(2)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Dividend</div>
                    <div class="metric-value">${((stock.dividendYield || 0) * 100).toFixed(2)}%</div>
                </div>
            </div>
            <div class="stock-score ${scoreClass}">${(stock.score || 0).toFixed(1)}</div>
        `;
        
        return card;
    }
    
    // Format market cap for display
    function formatMarketCap(marketCap) {
        if (!marketCap) return 'N/A';
        
        if (marketCap >= 1e12) {
            return `$${(marketCap / 1e12).toFixed(1)}T`;
        } else if (marketCap >= 1e9) {
            return `$${(marketCap / 1e9).toFixed(1)}B`;
        } else if (marketCap >= 1e6) {
            return `$${(marketCap / 1e6).toFixed(1)}M`;
        } else {
            return `$${(marketCap / 1e3).toFixed(1)}K`;
        }
    }
    
    // Get CSS class based on score
    function getScoreClass(score) {
        if (score >= 8) return 'excellent';
        if (score >= 6) return 'good';
        if (score >= 4) return 'average';
        if (score >= 2) return 'below-average';
        return 'poor';
    }
    
    // Update stats display at the top of the page
    function updateStatsDisplay(totalStocks) {
        const stocksCountElement = document.querySelector('.stats-count.stocks');
        const nyseCountElement = document.querySelector('.stats-count.nyse');
        const nasdaqCountElement = document.querySelector('.stats-count.nasdaq');
        
        if (stocksCountElement) {
            stocksCountElement.textContent = totalStocks || 0;
        }
        
        // Count stocks by exchange
        if (nyseCountElement || nasdaqCountElement) {
            let nyseCount = 0;
            let nasdaqCount = 0;
            
            stockData.forEach(stock => {
                if (stock.exchange === 'NYSE') nyseCount++;
                if (stock.exchange === 'NASDAQ') nasdaqCount++;
            });
            
            if (nyseCountElement) nyseCountElement.textContent = nyseCount;
            if (nasdaqCountElement) nasdaqCountElement.textContent = nasdaqCount;
        }
    }
    
    // Initialize
    const enhancedSearchInput = improveSearchFieldPlacement();
    checkConnectionAndLoadStocks();
    
    // Set up event listeners for the enhanced search
    if (enhancedSearchInput) {
        enhancedSearchInput.addEventListener('input', applyFilters);
        enhancedSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }
    
    // Set up periodic refresh
    setInterval(checkConnectionAndLoadStocks, 30000); // Check every 30 seconds
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = '🔄 Retry Connection';
    retryButton.style.position = 'fixed';
    retryButton.style.top = '40px';
    retryButton.style.right = '10px';
    retryButton.style.padding = '5px 10px';
    retryButton.style.backgroundColor = '#0066ff';
    retryButton.style.color = 'white';
    retryButton.style.border = 'none';
    retryButton.style.borderRadius = '4px';
    retryButton.style.cursor = 'pointer';
    
    retryButton.addEventListener('click', () => {
        checkConnectionAndLoadStocks();
    });
    
    document.body.appendChild(retryButton);
    
    console.log("Enhanced frontend fix initialization complete");
});
