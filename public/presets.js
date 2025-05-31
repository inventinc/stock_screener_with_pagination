// Presets Implementation for Stock Screener
// This file implements the preset functionality to replace the Ranking System

// Define the presets with their filters
const stockScreenerPresets = [
  {
    id: 'founders-fortune',
    name: "Founder's Fortune",
    icon: '👑',
    description: "Find companies still primarily owned by their founders with minimal debt and strong growth. These companies often have aligned management interests and long-term vision.",
    filters: [
      { type: 'insider-ownership', value: '15', operator: '>' },
      { type: 'debt-ebitda', value: '1.0', operator: '<=' },
      { type: 'revenue-growth', value: '10', operator: '>=' },
      { type: 'fcf-ni', value: '0.8', operator: '>=' },
      { type: 'share-cagr', value: '0', operator: '<=' }
    ]
  },
  {
    id: 'hidden-moat',
    name: "Hidden Moat Detector",
    icon: '🛡️',
    description: "Uncover companies with strong competitive advantages that the market may be undervaluing. These businesses show signs of durable economic moats through superior returns on capital and pricing power.",
    filters: [
      { type: 'roic', value: '25', operator: '>' },
      { type: 'gross-margin', value: '50', operator: '>' },
      { type: 'gross-margin-trend', value: 'increasing', operator: '=' },
      { type: 'ev-ebit', value: '15', operator: '<' },
      { type: 'debt-equity', value: '0.3', operator: '<' }
    ]
  },
  {
    id: 'resilient-income',
    name: "Resilient Income Generator",
    icon: '💰',
    description: "Discover financially strong companies with growing dividends and the ability to weather economic storms. These stocks combine income with stability.",
    filters: [
      { type: 'dividend-yield', value: '3', operator: '>' },
      { type: 'dividend-growth', value: '5', operator: '>' },
      { type: 'payout-ratio', value: '60', operator: '<' },
      { type: 'debt-ebitda', value: '2.0', operator: '<=' },
      { type: 'operating-margin', value: '15', operator: '>' },
      { type: 'beta', value: '0.8', operator: '<' }
    ]
  }
];

// Function to create the presets UI
function createPresetsUI() {
  console.log('Creating presets UI...');
  
  // Try multiple selectors to find the filters container
  let filtersContainer = document.querySelector('.filters-container');
  
  // If not found, try alternative selectors
  if (!filtersContainer) {
    filtersContainer = document.querySelector('.filters');
  }
  
  // If still not found, try the sidebar
  if (!filtersContainer) {
    filtersContainer = document.querySelector('.sidebar');
  }
  
  // If still not found, try any container that might hold filters
  if (!filtersContainer) {
    filtersContainer = document.querySelector('.filter-section')?.parentNode;
  }
  
  // If still not found, create a container
  if (!filtersContainer) {
    console.log('No filters container found, creating one');
    filtersContainer = document.createElement('div');
    filtersContainer.className = 'filters-container';
    
    // Try to find a good place to insert it
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.appendChild(filtersContainer);
    } else {
      // If no sidebar, try to insert before the stocks container
      const stocksContainer = document.getElementById('stocks-container');
      if (stocksContainer && stocksContainer.parentNode) {
        stocksContainer.parentNode.insertBefore(filtersContainer, stocksContainer);
      } else {
        // Last resort: append to body
        document.body.appendChild(filtersContainer);
      }
    }
  }
  
  // Check if presets section already exists
  if (document.querySelector('.presets-section')) {
    console.log('Presets section already exists');
    return;
  }
  
  // Create the new presets section
  const presetsSection = document.createElement('div');
  presetsSection.className = 'filter-section presets-section';
  presetsSection.innerHTML = `
    <div class="filter-section-header" id="presets-header">
      <div class="filter-section-title">
        <span>🎯</span>
        <span>Presets</span>
      </div>
      <span class="toggle-icon">▼</span>
    </div>
    <div class="filter-section-content" id="presets-content">
      <div class="presets-container">
        ${stockScreenerPresets.map(preset => `
          <div class="preset-card" data-preset-id="${preset.id}">
            <div class="preset-icon">${preset.icon}</div>
            <div class="preset-details">
              <h3 class="preset-name">${preset.name}</h3>
              <p class="preset-description">${preset.description}</p>
            </div>
            <button class="btn btn-primary apply-preset-btn" data-preset-id="${preset.id}">Apply Preset</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Find the ranking system section to replace, or just append to filters container
  const rankingSystemSection = document.querySelector('.filter-section.ranking-system');
  if (rankingSystemSection) {
    console.log('Found ranking system section, replacing it');
    rankingSystemSection.parentNode.replaceChild(presetsSection, rankingSystemSection);
  } else {
    console.log('No ranking system section found, appending to filters container');
    // Append as the last filter section
    filtersContainer.appendChild(presetsSection);
  }
  
  // Add event listeners to the preset buttons
  document.querySelectorAll('.apply-preset-btn').forEach(button => {
    button.addEventListener('click', function() {
      const presetId = this.getAttribute('data-preset-id');
      applyPreset(presetId);
    });
  });
  
  // Initialize the collapsible behavior
  initializeCollapsible('presets-header', 'presets-content');
  
  console.log('Presets UI created successfully');
}

// Function to apply a preset
function applyPreset(presetId) {
  // Find the selected preset
  const preset = stockScreenerPresets.find(p => p.id === presetId);
  if (!preset) return;
  
  // Clear all existing filters
  clearAllFilters();
  
  // Apply the preset filters
  preset.filters.forEach(filter => {
    applyFilter(filter.type, filter.value, filter.operator);
  });
  
  // Show a confirmation message
  showToast(`Preset Applied: ${preset.name}`);
  
  // Update the results
  updateResults();
}

// Function to clear all filters
function clearAllFilters() {
  // Find the clear all button by its ID or class instead of using :contains
  const clearAllButton = document.getElementById('clear-all-filters');
  if (clearAllButton) {
    console.log('Found Clear All button, clicking it');
    clearAllButton.click();
  } else {
    // Fallback: try to find by class
    const clearButtons = document.querySelectorAll('.btn-clear, .clear-filters-btn');
    if (clearButtons.length > 0) {
      console.log('Found Clear button by class, clicking it');
      clearButtons[0].click();
    } else {
      console.log('Clear All button not found, manually clearing filters');
      // Manually clear active filter chips
      document.querySelectorAll('.filter-chip.active').forEach(chip => {
        chip.classList.remove('active');
      });
      
      // Clear any input fields
      document.querySelectorAll('.filter-input').forEach(input => {
        input.value = '';
      });
    }
  }
}

// Function to apply a specific filter
function applyFilter(type, value, operator) {
  // This function would need to be implemented based on the existing filter application logic
  // For now, we'll log what would happen
  console.log(`Applying filter: ${type} ${operator} ${value}`);
  
  // Here you would find the corresponding filter element and set its value
  // This is a placeholder for the actual implementation
  const filterElements = document.querySelectorAll(`[data-filter="${type}"]`);
  filterElements.forEach(element => {
    if (element.classList.contains('filter-chip')) {
      element.classList.add('active');
    } else if (element.tagName === 'INPUT') {
      element.value = value;
    }
  });
}

// Function to update the results after applying filters
function updateResults() {
  // This function would trigger the existing results update logic
  // For now, we'll simulate it
  console.log('Updating results with new filters');
  
  // Try to find and call the existing filterStocks function
  if (typeof window.filterStocks === 'function') {
    window.filterStocks();
  } else {
    console.log('filterStocks function not found');
    // Try to trigger a refresh of the stocks display
    if (typeof window.loadLiveData === 'function') {
      window.loadLiveData();
    } else if (typeof window.loadSampleData === 'function') {
      window.loadSampleData();
    }
  }
}

// Function to show a toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Hide and remove the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Function to initialize collapsible behavior
function initializeCollapsible(headerId, contentId) {
  const header = document.getElementById(headerId);
  const content = document.getElementById(contentId);
  
  if (header && content) {
    header.addEventListener('click', function() {
      content.classList.toggle('expanded');
      const toggleIcon = this.querySelector('.toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = content.classList.contains('expanded') ? '▲' : '▼';
      }
    });
  }
}

// Add CSS for the presets
function addPresetsStyles() {
  // Check if styles already exist
  if (document.querySelector('style#presets-styles')) {
    console.log('Presets styles already exist');
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'presets-styles';
  styleElement.textContent = `
    .presets-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
    }
    
    .preset-card {
      background: linear-gradient(to right, var(--card-bg-color, #f5f5f5), var(--card-bg-color-light, #ffffff));
      border-radius: 8px;
      padding: 16px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .preset-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
    
    .preset-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--primary-color-light, #e6f7ff);
      border-radius: 50%;
    }
    
    .preset-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .preset-name {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: var(--text-color, #333333);
    }
    
    .preset-description {
      font-size: 12px;
      margin: 0;
      color: var(--text-color-secondary, #666666);
      line-height: 1.4;
    }
    
    .apply-preset-btn {
      padding: 6px 12px;
      font-size: 12px;
      white-space: nowrap;
      background-color: var(--primary-color, #1890ff);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .apply-preset-btn:hover {
      background-color: var(--primary-color-dark, #096dd9);
    }
    
    .toast-notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background-color: var(--primary-color, #1890ff);
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    
    .toast-notification.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    
    /* Ensure the filter section content is properly styled */
    .filter-section-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    
    .filter-section-content.expanded {
      max-height: 1000px;
      overflow: visible;
    }
    
    /* Mobile styles for presets */
    @media (max-width: 768px) {
      .preset-card {
        grid-template-columns: 1fr;
        text-align: center;
      }
      
      .preset-icon {
        margin: 0 auto;
      }
      
      .preset-description {
        display: none; /* Hide description on mobile to save space */
      }
    }
  `;
  document.head.appendChild(styleElement);
  console.log('Presets styles added successfully');
}

// Function to add presets to mobile bottom sheet
function addPresetsToMobileView() {
  // Find the mobile filter tabs
  const mobileFilterTabs = document.querySelector('.mobile-filter-tabs');
  if (!mobileFilterTabs) {
    console.log('Mobile filter tabs not found');
    return;
  }
  
  // Check if ranking tab exists and replace it with presets
  const rankingTab = Array.from(mobileFilterTabs.querySelectorAll('.filter-tab')).find(tab => 
    tab.textContent.trim().toLowerCase().includes('ranking')
  );
  
  if (rankingTab) {
    console.log('Found ranking tab in mobile view, replacing with presets');
    rankingTab.innerHTML = '🎯 Presets';
    rankingTab.setAttribute('data-tab', 'presets');
  } else {
    console.log('No ranking tab found in mobile view');
    
    // Check if presets tab already exists
    const presetsTab = Array.from(mobileFilterTabs.querySelectorAll('.filter-tab')).find(tab => 
      tab.textContent.trim().toLowerCase().includes('presets')
    );
    
    if (!presetsTab) {
      console.log('Adding new presets tab to mobile view');
      const newTab = document.createElement('div');
      newTab.className = 'filter-tab';
      newTab.setAttribute('data-tab', 'presets');
      newTab.innerHTML = '🎯 Presets';
      mobileFilterTabs.appendChild(newTab);
    }
  }
  
  // Make sure the mobile bottom sheet content includes presets
  const mobileBottomSheet = document.querySelector('.mobile-bottom-sheet-content');
  if (mobileBottomSheet) {
    // Check if presets section already exists in mobile view
    if (!mobileBottomSheet.querySelector('.mobile-filter-section[data-section="presets"]')) {
      console.log('Adding presets section to mobile bottom sheet');
      
      // Clone the presets section from desktop
      const desktopPresets = document.querySelector('.presets-section');
      if (desktopPresets) {
        const mobilePresets = desktopPresets.cloneNode(true);
        mobilePresets.classList.add('mobile-filter-section');
        mobilePresets.setAttribute('data-section', 'presets');
        mobileBottomSheet.appendChild(mobilePresets);
        
        // Add event listeners to the cloned preset buttons
        mobilePresets.querySelectorAll('.apply-preset-btn').forEach(button => {
          button.addEventListener('click', function() {
            const presetId = this.getAttribute('data-preset-id');
            applyPreset(presetId);
          });
        });
      } else {
        // If desktop presets don't exist yet, create directly in mobile
        const mobilePresets = document.createElement('div');
        mobilePresets.className = 'filter-section presets-section mobile-filter-section';
        mobilePresets.setAttribute('data-section', 'presets');
        mobilePresets.innerHTML = `
          <div class="filter-section-header" id="mobile-presets-header">
            <div class="filter-section-title">
              <span>🎯</span>
              <span>Presets</span>
            </div>
            <span class="toggle-icon">▼</span>
          </div>
          <div class="filter-section-content" id="mobile-presets-content">
            <div class="presets-container">
              ${stockScreenerPresets.map(preset => `
                <div class="preset-card" data-preset-id="${preset.id}">
                  <div class="preset-icon">${preset.icon}</div>
                  <div class="preset-details">
                    <h3 class="preset-name">${preset.name}</h3>
                    <p class="preset-description">${preset.description}</p>
                  </div>
                  <button class="btn btn-primary apply-preset-btn" data-preset-id="${preset.id}">Apply Preset</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        mobileBottomSheet.appendChild(mobilePresets);
        
        // Add event listeners to the preset buttons
        mobilePresets.querySelectorAll('.apply-preset-btn').forEach(button => {
          button.addEventListener('click', function() {
            const presetId = this.getAttribute('data-preset-id');
            applyPreset(presetId);
          });
        });
      }
    }
  }
}

// Initialize the presets feature
function initializePresets() {
  console.log('Initializing presets feature');
  addPresetsStyles();
  
  // Wait a short time to ensure DOM is fully processed
  setTimeout(() => {
    createPresetsUI();
    addPresetsToMobileView();
    
    // Ensure presets section starts collapsed
    const presetsContent = document.getElementById('presets-content');
    if (presetsContent) {
      presetsContent.classList.remove('expanded');
    }
    console.log('Presets initialization complete');
    
    // Force a data load to ensure stocks are displayed
    if (typeof window.loadLiveData === 'function') {
      console.log('Triggering loadLiveData to ensure stocks are displayed');
      window.loadLiveData();
    } else if (typeof window.loadSampleData === 'function') {
      console.log('Triggering loadSampleData to ensure stocks are displayed');
      window.loadSampleData();
    }
  }, 500);
}

// Call the initialization function when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing presets');
    initializePresets();
  });
} else {
  // If the DOM is already loaded, initialize immediately
  console.log('DOM already loaded, initializing presets immediately');
  initializePresets();
  
  // Also try again after a delay to ensure all other scripts have run
  setTimeout(initializePresets, 1000);
}

// Add a MutationObserver to handle dynamic DOM changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if filters container was added
      if ((document.querySelector('.filters-container') || document.querySelector('.filters') || document.querySelector('.sidebar')) && 
          !document.querySelector('.presets-section')) {
        console.log('Filters container detected in DOM changes, initializing presets');
        initializePresets();
      }
      
      // Check if mobile filter tabs were added
      if (document.querySelector('.mobile-filter-tabs')) {
        console.log('Mobile filter tabs detected, adding presets to mobile view');
        addPresetsToMobileView();
      }
      
      // Check if stocks container was added or updated
      if (document.getElementById('stocks-container') && 
          document.getElementById('stocks-container').children.length === 0) {
        console.log('Empty stocks container detected, triggering data load');
        if (typeof window.loadLiveData === 'function') {
          window.loadLiveData();
        } else if (typeof window.loadSampleData === 'function') {
          window.loadSampleData();
        }
      }
    }
  }
});

// Start observing the document body for DOM changes
observer.observe(document.body, { childList: true, subtree: true });

// Expose function for manual initialization
window.initializePresets = initializePresets;

// Ensure stocks are loaded
window.addEventListener('load', () => {
  console.log('Window loaded, ensuring stocks are displayed');
  setTimeout(() => {
    if (document.getElementById('stocks-container') && 
        document.getElementById('stocks-container').children.length === 0) {
      console.log('No stocks displayed after load, triggering data load');
      if (typeof window.loadLiveData === 'function') {
        window.loadLiveData();
      } else if (typeof window.loadSampleData === 'function') {
        window.loadSampleData();
      }
    }
  }, 1500);
});
