/**
 * PaginationControls - Pagination component for the stock screener
 */
class PaginationControls {
    /**
     * Create a new pagination control
     * @param {Object} options - Pagination options
     * @param {HTMLElement} options.container - Container element
     * @param {Number} options.totalItems - Total number of items
     * @param {Number} options.pageSize - Items per page
     * @param {Number} options.currentPage - Current page
     * @param {Function} options.onPageChange - Page change callback
     */
    constructor(options) {
        this.container = options.container;
        this.totalItems = options.totalItems || 0;
        this.pageSize = options.pageSize || 50;
        this.currentPage = options.currentPage || 1;
        this.onPageChange = options.onPageChange || function() {};
        
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        this.render();
    }
    
    /**
     * Update pagination
     * @param {Number} totalItems - New total items
     * @param {Number} currentPage - New current page
     */
    update(totalItems, currentPage) {
        this.totalItems = totalItems;
        this.currentPage = currentPage;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        this.render();
    }
    
    /**
     * Go to specific page
     * @param {Number} page - Page number
     */
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        this.onPageChange(page, this.pageSize);
        this.render();
    }
    
    /**
     * Render pagination controls
     */
    render() {
        // Clear container
        this.container.innerHTML = '';
        
        // Don't render if no items
        if (this.totalItems === 0) return;
        
        // Create pagination wrapper
        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = 'pagination-wrapper';
        
        // Create info text
        const infoText = document.createElement('div');
        infoText.className = 'pagination-info';
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
        
        infoText.textContent = `Showing ${startItem}-${endItem} of ${this.totalItems} stocks`;
        
        // Create controls
        const controls = document.createElement('div');
        controls.className = 'pagination-controls';
        
        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-button prev';
        prevButton.innerHTML = '&laquo;';
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        
        // Page buttons
        const pageButtons = document.createElement('div');
        pageButtons.className = 'pagination-pages';
        
        // Determine which pages to show
        let pagesToShow = [];
        
        if (this.totalPages <= 7) {
            // Show all pages if 7 or fewer
            pagesToShow = Array.from({length: this.totalPages}, (_, i) => i + 1);
        } else {
            // Always show first and last page
            pagesToShow.push(1);
            
            // Show ellipsis if not at start
            if (this.currentPage > 3) {
                pagesToShow.push('...');
            }
            
            // Show pages around current page
            const start = Math.max(2, this.currentPage - 1);
            const end = Math.min(this.totalPages - 1, this.currentPage + 1);
            
            for (let i = start; i <= end; i++) {
                pagesToShow.push(i);
            }
            
            // Show ellipsis if not at end
            if (this.currentPage < this.totalPages - 2) {
                pagesToShow.push('...');
            }
            
            // Add last page
            pagesToShow.push(this.totalPages);
        }
        
        // Create page buttons
        pagesToShow.forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pageButtons.appendChild(ellipsis);
            } else {
                const button = document.createElement('button');
                button.className = `pagination-button page ${page === this.currentPage ? 'active' : ''}`;
                button.textContent = page;
                button.addEventListener('click', () => this.goToPage(page));
                pageButtons.appendChild(button);
            }
        });
        
        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-button next';
        nextButton.innerHTML = '&raquo;';
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        
        // Assemble controls
        controls.appendChild(prevButton);
        controls.appendChild(pageButtons);
        controls.appendChild(nextButton);
        
        // Add page size selector
        const pageSizeSelector = document.createElement('div');
        pageSizeSelector.className = 'pagination-size-selector';
        
        const pageSizeLabel = document.createElement('span');
        pageSizeLabel.textContent = 'Items per page:';
        
        const pageSizeSelect = document.createElement('select');
        pageSizeSelect.className = 'pagination-size-select';
        
        [25, 50, 100, 250].forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            option.selected = size === this.pageSize;
            pageSizeSelect.appendChild(option);
        });
        
        pageSizeSelect.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.totalPages = Math.ceil(this.totalItems / this.pageSize);
            this.goToPage(1);
        });
        
        pageSizeSelector.appendChild(pageSizeLabel);
        pageSizeSelector.appendChild(pageSizeSelect);
        
        // Assemble pagination
        paginationWrapper.appendChild(infoText);
        paginationWrapper.appendChild(controls);
        paginationWrapper.appendChild(pageSizeSelector);
        
        // Add to container
        this.container.appendChild(paginationWrapper);
        
        // Add pagination styles if not already added
        if (!document.getElementById('pagination-styles')) {
            const style = document.createElement('style');
            style.id = 'pagination-styles';
            style.textContent = `
                .pagination-wrapper {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 20px;
                    padding: 16px;
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .pagination-info {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 10px;
                    flex: 1 0 100%;
                }
                
                .pagination-controls {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .pagination-button {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-width: 36px;
                    height: 36px;
                    padding: 0 8px;
                    border-radius: 4px;
                    border: 1px solid #e1e4e8;
                    background-color: #fff;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .pagination-button:hover:not(:disabled) {
                    border-color: #0066ff;
                    color: #0066ff;
                }
                
                .pagination-button.active {
                    background-color: #0066ff;
                    color: #fff;
                    border-color: #0066ff;
                }
                
                .pagination-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .pagination-pages {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .pagination-ellipsis {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-width: 36px;
                    height: 36px;
                    font-size: 14px;
                    color: #666;
                }
                
                .pagination-size-selector {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: #666;
                }
                
                .pagination-size-select {
                    padding: 6px 8px;
                    border-radius: 4px;
                    border: 1px solid #e1e4e8;
                    background-color: #fff;
                    font-size: 14px;
                    cursor: pointer;
                }
                
                @media (max-width: 768px) {
                    .pagination-wrapper {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    
                    .pagination-controls {
                        width: 100%;
                        justify-content: center;
                    }
                    
                    .pagination-size-selector {
                        width: 100%;
                        justify-content: flex-end;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
