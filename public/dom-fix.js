/**
 * DOM Element Fix for Stock Screener
 * 
 * This script fixes the DOM element reference issue in paginatedApp.js
 * by ensuring the correct stock cards container element is available.
 */

// Execute immediately when loaded
(function() {
    console.log('DOM Element Fix: Starting...');
    
    // Function to fix the DOM element references
    function fixDomReferences() {
        console.log('DOM Element Fix: Checking for missing elements...');
        
        // Check if the stock-cards element exists
        const stockCardsElement = document.getElementById('stock-cards');
        
        // Check if the stock-cards-container element exists
        const stockCardsContainer = document.getElementById('stock-cards-container');
        
        // If stock-cards doesn't exist but stock-cards-container does
        if (!stockCardsElement && stockCardsContainer) {
            console.log('DOM Element Fix: Creating stock-cards element as alias to stock-cards-container');
            
            // Create a reference to the existing container
            Object.defineProperty(window, 'stockCardsContainer', {
                get: function() {
                    return document.getElementById('stock-cards-container');
                }
            });
            
            // Patch the getElementById function to return stock-cards-container when stock-cards is requested
            const originalGetElementById = document.getElementById;
            document.getElementById = function(id) {
                if (id === 'stock-cards') {
                    console.log('DOM Element Fix: Redirecting stock-cards to stock-cards-container');
                    return document.querySelector('#stock-cards-container');
                }
                return originalGetElementById.call(document, id);
            };
        }
        // If neither exists, create the stock-cards element
        else if (!stockCardsElement && !stockCardsContainer) {
            console.log('DOM Element Fix: Creating missing stock-cards element');
            
            // Find the stocks section
            const stocksSection = document.getElementById('stocks-section');
            
            if (stocksSection) {
                // Create the stock-cards element
                const newStockCards = document.createElement('div');
                newStockCards.id = 'stock-cards';
                newStockCards.className = 'stock-cards-container';
                
                // Find where to insert it (before the table container or pagination)
                const tableContainer = document.getElementById('stock-table-container');
                const paginationContainer = document.getElementById('pagination-container');
                
                if (tableContainer) {
                    stocksSection.insertBefore(newStockCards, tableContainer);
                } else if (paginationContainer) {
                    stocksSection.insertBefore(newStockCards, paginationContainer);
                } else {
                    stocksSection.appendChild(newStockCards);
                }
                
                console.log('DOM Element Fix: Created stock-cards element');
            } else {
                console.error('DOM Element Fix: Could not find stocks-section to add stock-cards');
            }
        }
        
        // Check if the card-view-button and table-view-button elements exist
        const cardViewButton = document.getElementById('card-view-button');
        const tableViewButton = document.getElementById('table-view-button');
        
        // If they don't exist, look for view buttons with data-view attributes
        if (!cardViewButton || !tableViewButton) {
            console.log('DOM Element Fix: Fixing view button references');
            
            // Find buttons with data-view attributes
            const viewButtons = document.querySelectorAll('.view-button[data-view]');
            
            viewButtons.forEach(button => {
                const view = button.dataset.view;
                
                if (view === 'cards' && !cardViewButton) {
                    // Create a reference to this button as card-view-button
                    button.id = 'card-view-button';
                    console.log('DOM Element Fix: Added id card-view-button to cards view button');
                } else if (view === 'table' && !tableViewButton) {
                    // Create a reference to this button as table-view-button
                    button.id = 'table-view-button';
                    console.log('DOM Element Fix: Added id table-view-button to table view button');
                }
            });
        }
    }
    
    // Wait for DOM to be loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixDomReferences);
    } else {
        // DOM already loaded, fix immediately
        fixDomReferences();
    }
    
    // Also fix when window is fully loaded
    window.addEventListener('load', function() {
        // Wait a moment to ensure all scripts are loaded
        setTimeout(fixDomReferences, 100);
    });
    
    console.log('DOM Element Fix: Setup complete');
})();
