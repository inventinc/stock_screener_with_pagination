/**
 * PaginationControls - Robust pagination component for large datasets
 * 
 * Features:
 * - Classic numbered pagination with modern UX
 * - Page size selection
 * - Mobile-optimized controls
 * - URL state persistence
 * - Accessibility support
 */
class PaginationControls {
  /**
   * Create a new PaginationControls instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element
   * @param {Number} options.totalItems - Total number of items
   * @param {Number} options.pageSize - Items per page
   * @param {Number} options.currentPage - Current page number
   * @param {Function} options.onPageChange - Callback when page changes
   * @param {Number} options.maxPageButtons - Maximum number of page buttons to show
   */
  constructor(options) {
    this.container = options.container;
    this.totalItems = options.totalItems || 0;
    this.pageSize = options.pageSize || 50;
    this.currentPage = options.currentPage || 1;
    this.onPageChange = options.onPageChange || (() => {});
    this.maxPageButtons = options.maxPageButtons || 5;
    
    // Initialize from URL if available
    this.initFromUrl();
    
    // Render initial state
    this.render();
  }
  
  /**
   * Initialize from URL parameters
   */
  initFromUrl() {
    try {
      const url = new URL(window.location);
      const page = parseInt(url.searchParams.get('page'));
      const pageSize = parseInt(url.searchParams.get('pageSize'));
      
      if (page && !isNaN(page)) {
        this.currentPage = page;
      }
      
      if (pageSize && !isNaN(pageSize) && [25, 50, 100].includes(pageSize)) {
        this.pageSize = pageSize;
      }
    } catch (error) {
      console.warn('Error parsing URL parameters:', error);
    }
  }
  
  /**
   * Render pagination controls
   */
  render() {
    const totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    
    // Ensure current page is within valid range
    this.currentPage = Math.max(1, Math.min(this.currentPage, totalPages));
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create pagination controls
    const paginationEl = document.createElement('div');
    paginationEl.className = 'pagination-controls';
    paginationEl.setAttribute('role', 'navigation');
    paginationEl.setAttribute('aria-label', 'Pagination');
    
    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    paginationEl.appendChild(pageInfo);
    
    // Previous button
    const prevButton = this.createButton('Previous', this.currentPage > 1);
    prevButton.setAttribute('aria-label', 'Go to previous page');
    prevButton.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    paginationEl.appendChild(prevButton);
    
    // Page buttons
    const pageButtons = this.createPageButtons(totalPages);
    pageButtons.forEach(button => paginationEl.appendChild(button));
    
    // Next button
    const nextButton = this.createButton('Next', this.currentPage < totalPages);
    nextButton.setAttribute('aria-label', 'Go to next page');
    nextButton.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    paginationEl.appendChild(nextButton);
    
    // Page size selector
    const pageSizeSelector = this.createPageSizeSelector();
    paginationEl.appendChild(pageSizeSelector);
    
    // Add to container
    this.container.appendChild(paginationEl);
    
    // Add swipe support for mobile
    this.addSwipeSupport();
  }
  
  /**
   * Create page buttons
   * @param {Number} totalPages - Total number of pages
   * @returns {Array} Array of button elements
   */
  createPageButtons(totalPages) {
    const buttons = [];
    
    // Calculate range of page buttons to show
    let startPage = Math.max(1, this.currentPage - Math.floor(this.maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + this.maxPageButtons - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < this.maxPageButtons) {
      startPage = Math.max(1, endPage - this.maxPageButtons + 1);
    }
    
    // First page button
    if (startPage > 1) {
      buttons.push(this.createPageButton(1));
      if (startPage > 2) {
        buttons.push(this.createEllipsis());
      }
    }
    
    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(this.createPageButton(i));
    }
    
    // Last page button
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(this.createEllipsis());
      }
      buttons.push(this.createPageButton(totalPages));
    }
    
    return buttons;
  }
  
  /**
   * Create a page button
   * @param {Number} page - Page number
   * @returns {HTMLElement} Button element
   */
  createPageButton(page) {
    const button = document.createElement('button');
    button.className = `page-button ${page === this.currentPage ? 'active' : ''}`;
    button.textContent = page;
    button.setAttribute('aria-label', `Page ${page}`);
    button.setAttribute('aria-current', page === this.currentPage ? 'page' : 'false');
    button.addEventListener('click', () => this.goToPage(page));
    return button;
  }
  
  /**
   * Create an ellipsis element
   * @returns {HTMLElement} Span element
   */
  createEllipsis() {
    const span = document.createElement('span');
    span.className = 'page-ellipsis';
    span.textContent = '...';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  
  /**
   * Create a button element
   * @param {String} text - Button text
   * @param {Boolean} enabled - Whether the button is enabled
   * @returns {HTMLElement} Button element
   */
  createButton(text, enabled) {
    const button = document.createElement('button');
    button.className = `pagination-button ${!enabled ? 'disabled' : ''}`;
    button.textContent = text;
    button.disabled = !enabled;
    return button;
  }
  
  /**
   * Create page size selector
   * @returns {HTMLElement} Container element
   */
  createPageSizeSelector() {
    const container = document.createElement('div');
    container.className = 'page-size-selector';
    
    const label = document.createElement('label');
    label.textContent = 'Items per page:';
    label.setAttribute('for', 'page-size-select');
    container.appendChild(label);
    
    const select = document.createElement('select');
    select.id = 'page-size-select';
    select.setAttribute('aria-label', 'Select number of items per page');
    
    [25, 50, 100].forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      option.selected = size === this.pageSize;
      select.appendChild(option);
    });
    
    select.addEventListener('change', () => {
      this.pageSize = parseInt(select.value);
      this.goToPage(1); // Reset to first page when changing page size
    });
    
    container.appendChild(select);
    return container;
  }
  
  /**
   * Go to a specific page
   * @param {Number} page - Page number
   */
  goToPage(page) {
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    const validPage = Math.max(1, Math.min(page, totalPages));
    
    if (validPage !== this.currentPage) {
      this.currentPage = validPage;
      this.onPageChange(validPage, this.pageSize);
      this.render();
      
      // Update URL for bookmarking/sharing
      this.updateUrl();
      
      // Scroll to top of content
      window.scrollTo({
        top: this.container.offsetTop - 100,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Update URL with current page and page size
   */
  updateUrl() {
    try {
      const url = new URL(window.location);
      url.searchParams.set('page', this.currentPage);
      url.searchParams.set('pageSize', this.pageSize);
      window.history.replaceState({}, '', url);
    } catch (error) {
      console.warn('Error updating URL:', error);
    }
  }
  
  /**
   * Update pagination state
   * @param {Number} totalItems - Total number of items
   * @param {Number} currentPage - Current page number
   */
  update(totalItems, currentPage) {
    this.totalItems = totalItems || 0;
    
    if (currentPage) {
      this.currentPage = currentPage;
    }
    
    this.render();
  }
  
  /**
   * Add swipe support for mobile devices
   */
  addSwipeSupport() {
    let touchStartX = 0;
    let touchEndX = 0;
    
    this.container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    this.container.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, { passive: true });
    
    this.handleSwipe = () => {
      const totalPages = Math.ceil(this.totalItems / this.pageSize);
      const swipeThreshold = 50; // Minimum swipe distance
      
      // Swipe right to go to previous page
      if (touchEndX - touchStartX > swipeThreshold && this.currentPage > 1) {
        this.goToPage(this.currentPage - 1);
      }
      
      // Swipe left to go to next page
      if (touchStartX - touchEndX > swipeThreshold && this.currentPage < totalPages) {
        this.goToPage(this.currentPage + 1);
      }
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationControls;
}
