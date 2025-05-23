/**
 * Enhanced app.js for stock screener with improved MongoDB connection handling
 * This version includes better error handling and connection status display
 */

// Global variables
let stockDataManager = null;
let activeFilters = {
    preset: null,
    market_cap: [],
    volume: [],
    debt: [],
    valuation: []
};
let connectionStatus = 'connecting';
let stocksLoaded = false;

// DOM elements
const stockCardsContainer = document.getElementById('stock-cards-container');
const stockTableContainer = document.getElementById('stock-table-container');
const filterButtons = document.querySelectorAll('.filter-button:not([data-preset])');
const presetButtons = document.querySelectorAll('.filter-button[data-preset]');
const viewButtons = document.querySelectorAll('.view-button');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const searchInput = document.getElementById('search-input');
const exportCsvBtn = document.getElementById('export-csv-btn');
const loadingProgressBar = document.getElementById('loading-progress-bar');
const loadingProgressText = document.getElementById('loading-progress-text');
const connectionStatusElement = document.createElement('div');

// Add connection status indicator to the page
connectionStatusElement.className = 'connection-status';
connectionStatusElement.style.position = 'fixed';
connectionStatusElement.style.top = '10px';
connectionStatusElement.style.left = '10px';
connectionStatusElement.style.padding = '5px 10px';
connectionStatusElement.style.borderRadius = '4px';
connectionStatusElement.style.fontSize = '12px';
connectionStatusElement.style.zIndex = '1000';
document.body.appendChild(connectionStatusElement);

// Update connection status display
function updateConnectionStatus(status) {
    connectionStatus = status;
    
    if (status === 'connected') {
        connectionStatusElement.textContent = '🟢 Connected';
        connectionStatusElement.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        connectionStatusElement.style.color = 'white';
    } else if (status === 'connecting') {
        connectionStatusElement.textContent = '🟠 Connecting...';
        connectionStatusElement.style.backgroundColor = 'rgba(255, 165, 0, 0.7)';
        connectionStatusElement.style.color = 'white';
    } else {
        connectionStatusElement.textContent = '🔴 Disconnected';
        connectionStatusElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        connectionStatusElement.style.color = 'white';
    }
}

// Initialize the app
async function initApp() {
    updateConnectionStatus('connecting');
    
    try {
        // Determine API base URL based on environment
        const apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : '/api';
        
        // Test connection to API
        const response = await fetch(`${apiBaseUrl}/status`);
        
        if (!response.ok) {
            throw new Error(`API status check failed: ${response.status}`);
        }
        
        const statusData = await response.json();
        
        if (statusData.database === 'connected') {
            updateConnectionStatus('connected');
        } else {
            updateConnectionStatus('disconnected');
            throw new Error('Database is not connected');
        }
        
        // Initialize data manager
        stockDataManager = new StockDataManager(apiBaseUrl);
        
        // Load stocks
        await loadStocks();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set default view
        setActiveView('card');
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        updateConnectionStatus('disconnected');
        showErrorMessage('Failed to connect to the database. Please try again later.');
    }
}

// Load stocks from API
async function loadStocks() {
    if (!stockDataManager) return;
    
    try {
        updateLoadingProgress(0, 'Connecting to database...');
        
        // Fetch stocks with progress updates
        await stockDataManager.fetchStocks(
            (progress) => {
                updateLoadingProgress(progress, `Loading stocks... ${Math.round(progress)}%`);
            }
        );
        
        updateLoadingProgress(100, 'Stocks loaded successfully!');
        
        // Render initial view
        renderStockCards();
        
        // Hide loading indicators after a delay
        setTimeout(() => {
            if (loadingProgressBar) loadingProgressBar.style.display = 'none';
            if (loadingProgressText) loadingProgressText.style.display = 'none';
        }, 1000);
        
        stocksLoaded = true;
        
    } catch (error) {
        console.error('Failed to load stocks:', error);
        updateLoadingProgress(100, 'Failed to load stocks');
        updateConnectionStatus('disconnected');
        showErrorMessage('Failed to load stocks. Please check your connection and try again.');
    }
}

// Update loading progress indicators
function updateLoadingProgress(progress, text) {
    if (loadingProgressBar) {
        const progressInner = loadingProgressBar.querySelector('.progress-inner');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
    }
    
    if (loadingProgressText) {
        loadingProgressText.textContent = text;
    }
}

// Show error message
function showErrorMessage(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.position = 'fixed';
    errorElement.style.top = '50%';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translate(-50%, -50%)';
    errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorElement.style.color = 'white';
    errorElement.style.padding = '20px';
    errorElement.style.borderRadius = '5px';
    errorElement.style.zIndex = '2000';
    
    document.body.appendChild(errorElement);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '5px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    
    closeButton.addEventListener('click', () => {
        document.body.removeChild(errorElement);
    });
    
    errorElement.appendChild(closeButton);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (document.body.contains(errorElement)) {
            document.body.removeChild(errorElement);
        }
    }, 10000);
}

// Set up event listeners
function setupEventListeners() {
    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            const value = button.dataset.value;
            
            // Toggle active state
            button.classList.toggle('active');
            
            // Update active filters
            if (!activeFilters[filter]) {
                activeFilters[filter] = [];
            }
            
            const index = activeFilters[filter].indexOf(value);
            if (index === -1) {
                activeFilters[filter].push(value);
            } else {
                activeFilters[filter].splice(index, 1);
            }
            
            // Reset preset filter
            activeFilters.preset = null;
            presetButtons.forEach(btn => btn.classList.remove('active'));
            
            // Apply filters
            applyFilters();
        });
    });
    
    // Preset buttons
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset;
            
            // Reset all filters
            resetFilters();
            
            // Set preset
            activeFilters.preset = preset;
            button.classList.add('active');
            
            // Apply filters
            applyFilters();
        });
    });
    
    // Reset filters button
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            resetFilters();
            applyFilters();
        });
    }
    
    // View buttons
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            setActiveView(button.dataset.view);
        });
    });
    
    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFilters();
        });
    }
    
    // Export CSV button
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    
    // Retry connection button
    const retryButton = document.createElement('button');
    retryButton.textContent = '🔄 Retry Connection';
    retryButton.style.position = 'fixed';
    retryButton.style.top = '10px';
    retryButton.style.left = '150px';
    retryButton.style.padding = '5px 10px';
    retryButton.style.borderRadius = '4px';
    retryButton.style.fontSize = '12px';
    retryButton.style.backgroundColor = '#0066ff';
    retryButton.style.color = 'white';
    retryButton.style.border = 'none';
    retryButton.style.cursor = 'pointer';
    retryButton.style.zIndex = '1000';
    retryButton.style.display = 'none';
    
    retryButton.addEventListener('click', async () => {
        retryButton.disabled = true;
        retryButton.textContent = '🔄 Retrying...';
        
        try {
            await initApp();
            
            if (connectionStatus === 'connected') {
                retryButton.style.display = 'none';
            } else {
                retryButton.disabled = false;
                retryButton.textContent = '🔄 Retry Connection';
            }
        } catch (error) {
            console.error('Retry failed:', error);
            retryButton.disabled = false;
            retryButton.textContent = '🔄 Retry Connection';
        }
    });
    
    document.body.appendChild(retryButton);
    
    // Show retry button when disconnected
    setInterval(() => {
        if (connectionStatus === 'disconnected') {
            retryButton.style.display = 'block';
        } else {
            retryButton.style.display = 'none';
        }
    }, 1000);
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Periodically check connection status
setInterval(async () => {
    if (!stockDataManager) return;
    
    try {
        const apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : '/api';
            
        const response = await fetch(`${apiBaseUrl}/status`);
        
        if (!response.ok) {
            updateConnectionStatus('disconnected');
            return;
        }
        
        const statusData = await response.json();
        
        if (statusData.database === 'connected') {
            updateConnectionStatus('connected');
            
            // If stocks weren't loaded before, try loading them now
            if (!stocksLoaded) {
                loadStocks();
            }
        } else {
            updateConnectionStatus('disconnected');
        }
    } catch (error) {
        console.error('Failed to check connection status:', error);
        updateConnectionStatus('disconnected');
    }
}, 30000); // Check every 30 seconds
