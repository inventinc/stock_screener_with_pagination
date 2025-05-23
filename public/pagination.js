/**
 * Pagination Component for Stock Screener
 * 
 * This module provides pagination functionality for the stock screener application.
 * It creates a pagination control that allows users to navigate through pages of stocks.
 */

/**
 * Create a pagination component
 * @param {Object} options - Configuration options
 * @param {Number} options.currentPage - Current page number
 * @param {Number} options.totalPages - Total number of pages
 * @param {Function} options.onPageChange - Callback function when page changes
 * @param {Boolean} options.showPageSizeSelector - Whether to show page size selector
 * @param {Number} options.pageSize - Current page size
 * @param {Function} options.onPageSizeChange - Callback function when page size changes
 * @returns {HTMLElement} Pagination container element
 */
function createPagination(options) {
    const {
        currentPage = 1,
        totalPages = 1,
        onPageChange = () => {},
        showPageSizeSelector = false,
        pageSize = 50,
        onPageSizeChange = () => {}
    } = options;

    // Create container
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    
    // Create page size selector if enabled
    if (showPageSizeSelector) {
        const pageSizeContainer = document.createElement('div');
        pageSizeContainer.className = 'page-size-container';
        
        const pageSizeLabel = document.createElement('span');
        pageSizeLabel.className = 'page-size-label';
        pageSizeLabel.textContent = 'Items per page:';
        
        const pageSizeSelect = document.createElement('select');
        pageSizeSelect.className = 'page-size-select';
        
        [10, 25, 50, 100].forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            option.selected = size === pageSize;
            pageSizeSelect.appendChild(option);
        });
        
        pageSizeSelect.addEventListener('change', () => {
            onPageSizeChange(parseInt(pageSizeSelect.value));
        });
        
        pageSizeContainer.appendChild(pageSizeLabel);
        pageSizeContainer.appendChild(pageSizeSelect);
        paginationContainer.appendChild(pageSizeContainer);
    }
    
    // Create pagination controls
    const paginationControls = document.createElement('div');
    paginationControls.className = 'pagination-controls';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button prev-button';
    prevButton.innerHTML = '<span class="pagination-icon">←</span> Previous';
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    });
    
    // Page numbers
    const pageNumbers = document.createElement('div');
    pageNumbers.className = 'page-numbers';
    
    // Calculate range of pages to show
    const range = getPageRange(currentPage, totalPages);
    
    range.forEach(pageNum => {
        if (pageNum === '...') {
            // Ellipsis
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        } else {
            // Page number button
            const pageButton = document.createElement('button');
            pageButton.className = `page-number ${pageNum === currentPage ? 'active' : ''}`;
            pageButton.textContent = pageNum;
            pageButton.addEventListener('click', () => {
                if (pageNum !== currentPage) {
                    onPageChange(pageNum);
                }
            });
            pageNumbers.appendChild(pageButton);
        }
    });
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button next-button';
    nextButton.innerHTML = 'Next <span class="pagination-icon">→</span>';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    });
    
    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Assemble pagination controls
    paginationControls.appendChild(prevButton);
    paginationControls.appendChild(pageNumbers);
    paginationControls.appendChild(nextButton);
    
    // Add to container
    paginationContainer.appendChild(paginationControls);
    paginationContainer.appendChild(pageInfo);
    
    return paginationContainer;
}

/**
 * Calculate which page numbers to show
 * @param {Number} currentPage - Current page number
 * @param {Number} totalPages - Total number of pages
 * @returns {Array} Array of page numbers and ellipses to display
 */
function getPageRange(currentPage, totalPages) {
    // For small number of pages, show all
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // For larger number of pages, show a subset with ellipses
    const range = [];
    
    // Always include first page
    range.push(1);
    
    // Calculate start and end of range around current page
    if (currentPage <= 3) {
        // Near the start
        range.push(2, 3, 4, 5, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
        // Near the end
        range.push('...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
        // In the middle
        range.push('...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    
    return range;
}

/**
 * Add CSS styles for pagination
 */
function addPaginationStyles() {
    // Check if styles already exist
    if (document.getElementById('pagination-styles')) {
        return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'pagination-styles';
    styleElement.textContent = `
        .pagination-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 24px 0;
            gap: 12px;
        }
        
        .pagination-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .pagination-button {
            padding: 8px 16px;
            border: 1px solid #e1e4e8;
            background-color: #fff;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .pagination-button:hover:not(:disabled) {
            border-color: #0066ff;
            color: #0066ff;
        }
        
        .pagination-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .pagination-icon {
            font-size: 16px;
        }
        
        .page-numbers {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .page-number {
            width: 36px;
            height: 36px;
            display: flex;
            justify-content: center;
            align-items: center;
            border: 1px solid #e1e4e8;
            background-color: #fff;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .page-number:hover:not(.active) {
            border-color: #0066ff;
            color: #0066ff;
        }
        
        .page-number.active {
            background-color: #0066ff;
            color: #fff;
            border-color: #0066ff;
        }
        
        .page-ellipsis {
            width: 36px;
            height: 36px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 14px;
            color: #666;
        }
        
        .page-info {
            font-size: 14px;
            color: #666;
        }
        
        .page-size-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .page-size-label {
            font-size: 14px;
            color: #666;
        }
        
        .page-size-select {
            padding: 4px 8px;
            border: 1px solid #e1e4e8;
            border-radius: 4px;
            font-size: 14px;
            background-color: #fff;
            cursor: pointer;
        }
        
        @media (max-width: 576px) {
            .pagination-controls {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .pagination-button {
                padding: 6px 12px;
                font-size: 13px;
            }
            
            .page-number {
                width: 32px;
                height: 32px;
                font-size: 13px;
            }
            
            .page-ellipsis {
                width: 24px;
            }
        }
    `;
    
    document.head.appendChild(styleElement);
}

// Export functions
window.StockPagination = {
    createPagination,
    addPaginationStyles
};
