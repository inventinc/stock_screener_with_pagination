/**
 * PaginationControls - Simple pagination component
 * 
 * Features:
 * - Customizable page size
 * - First, previous, next, last page navigation
 * - Page number input
 * - Responsive design
 */
class PaginationControls {
    /**
     * Create pagination controls
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element
     * @param {Number} options.totalItems - Total number of items
     * @param {Number} options.pageSize - Items per page
     * @param {Number} options.currentPage - Current page number
     * @param {Function} options.onPageChange - Callback when page changes
     */
    constructor(options) {
        this.container = options.container;
        this.totalItems = options.totalItems || 0;
        this.pageSize = options.pageSize || 10;
        this.currentPage = options.currentPage || 1;
        this.onPageChange = options.onPageChange || function() {};
        
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        this.render();
    }
    
    /**
     * Update pagination with new data
     * @param {Number} totalItems - New total items count
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
     * @param {Number} page - Page number to go to
     */
    goToPage(page) {
        if (page < 1) page = 1;
        if (page > this.totalPages) page = this.totalPages;
        
        if (page !== this.currentPage) {
            this.currentPage = page;
            this.onPageChange(this.currentPage, this.pageSize);
            this.render();
        }
    }
    
    /**
     * Render pagination controls
     */
    render() {
        // Clear container
        this.container.innerHTML = '';
        
        // Don't render if no items
        if (this.totalItems === 0) {
            return;
        }
        
        // Create pagination element
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        
        // Add pagination info
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'pagination-info';
        paginationInfo.textContent = `Page ${this.currentPage} of ${this.totalPages || 1}`;
        pagination.appendChild(paginationInfo);
        
        // Add pagination controls
        const paginationControls = document.createElement('div');
        paginationControls.className = 'pagination-controls';
        
        // First page button
        const firstPageButton = document.createElement('button');
        firstPageButton.className = 'pagination-button first-page';
        firstPageButton.innerHTML = '&laquo;';
        firstPageButton.disabled = this.currentPage === 1;
        firstPageButton.addEventListener('click', () => this.goToPage(1));
        paginationControls.appendChild(firstPageButton);
        
        // Previous page button
        const prevPageButton = document.createElement('button');
        prevPageButton.className = 'pagination-button prev-page';
        prevPageButton.innerHTML = '&lsaquo;';
        prevPageButton.disabled = this.currentPage === 1;
        prevPageButton.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        paginationControls.appendChild(prevPageButton);
        
        // Page input
        const pageInput = document.createElement('input');
        pageInput.type = 'number';
        pageInput.className = 'pagination-input';
        pageInput.min = 1;
        pageInput.max = this.totalPages || 1;
        pageInput.value = this.currentPage;
        pageInput.addEventListener('change', () => {
            const page = parseInt(pageInput.value);
            if (!isNaN(page)) {
                this.goToPage(page);
            }
        });
        paginationControls.appendChild(pageInput);
        
        // Next page button
        const nextPageButton = document.createElement('button');
        nextPageButton.className = 'pagination-button next-page';
        nextPageButton.innerHTML = '&rsaquo;';
        nextPageButton.disabled = this.currentPage === this.totalPages || this.totalPages === 0;
        nextPageButton.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        paginationControls.appendChild(nextPageButton);
        
        // Last page button
        const lastPageButton = document.createElement('button');
        lastPageButton.className = 'pagination-button last-page';
        lastPageButton.innerHTML = '&raquo;';
        lastPageButton.disabled = this.currentPage === this.totalPages || this.totalPages === 0;
        lastPageButton.addEventListener('click', () => this.goToPage(this.totalPages));
        paginationControls.appendChild(lastPageButton);
        
        pagination.appendChild(paginationControls);
        
        // Add to container
        this.container.appendChild(pagination);
        
        // Add pagination styles if not already added
        if (!document.getElementById('pagination-styles')) {
            const style = document.createElement('style');
            style.id = 'pagination-styles';
            style.textContent = `
                .pagination {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 16px 0;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .pagination-info {
                    font-size: 14px;
                    color: #666;
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
                    width: 36px;
                    height: 36px;
                    border-radius: 4px;
                    border: 1px solid #e1e4e8;
                    background-color: #fff;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .pagination-button:hover:not(:disabled) {
                    border-color: #0066ff;
                    color: #0066ff;
                }
                
                .pagination-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .pagination-input {
                    width: 50px;
                    height: 36px;
                    border-radius: 4px;
                    border: 1px solid #e1e4e8;
                    background-color: #fff;
                    font-size: 14px;
                    text-align: center;
                    outline: none;
                    transition: border-color 0.2s ease;
                }
                
                .pagination-input:focus {
                    border-color: #0066ff;
                }
                
                @media (max-width: 480px) {
                    .pagination {
                        flex-direction: column;
                        align-items: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
