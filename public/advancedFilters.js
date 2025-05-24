/**
 * Advanced filters UI component for the Stock Screener application
 * Implements detailed filtering criteria as specified by the user
 */

// Advanced Filters UI Component
class AdvancedFilters {
    constructor(options) {
        this.container = options.container;
        this.onFilterChange = options.onFilterChange || function() {};
        this.filters = {
            marketCapMin: 15000000,       // $15M minimum
            marketCapMax: 5000000000000,  // $5T maximum
            tradingVolumeMin: 50000,      // $50K minimum
            debtToEbitdaMax: 1,           // ≤ 1×
            rotceMin: 12,                 // ≥ 12%
            fcfToIncomeMin: 80,           // ≥ 80%
            shareCountCagrMax: 0,         // ≤ 0%
            evToEbitMax: 10,              // ≤ 10×
            deepValueFlag: false,         // Optional deep value flag
            moatTagging: false,           // Moat tagging
            insiderOwnershipMin: 8,       // ≥ 8%
            insiderBuyers: false,         // Net buyers in past 12 months
            grossMarginDecline: false,    // No gross margin decline
            incrementalRoicMin: 15,       // ≥ 15%
            auditWarnings: false,         // No audit warnings
            cSuiteDepartures: 1           // Max 1 C-suite departure
        };
        
        this.init();
    }
    
    init() {
        this.render();
        this.setupEventListeners();
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="advanced-filters">
                <h3>Hard Pass Filters</h3>
                <div class="filter-group">
                    <div class="filter-row">
                        <label>Market Cap:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min: $</span>
                                <input type="number" id="market-cap-min" value="15" min="0" step="1" />
                                <span>M</span>
                            </div>
                            <div class="input-group">
                                <span>Max: $</span>
                                <input type="number" id="market-cap-max" value="5000" min="0" step="1" />
                                <span>B</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>30-day Avg Trading Volume:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min: $</span>
                                <input type="number" id="trading-volume-min" value="50" min="0" step="1" />
                                <span>K</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Net Debt / EBITDA:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Max:</span>
                                <input type="number" id="debt-to-ebitda-max" value="1" min="0" step="0.1" />
                                <span>×</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Return on Tangible Capital:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min:</span>
                                <input type="number" id="rotce-min" value="12" min="0" step="1" />
                                <span>%</span>
                            </div>
                            <span class="filter-note">(each of last 3 years)</span>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>5-year Total FCF ÷ Total Net Income:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min:</span>
                                <input type="number" id="fcf-to-income-min" value="80" min="0" step="1" />
                                <span>%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Share Count CAGR (5 years):</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Max:</span>
                                <input type="number" id="share-count-cagr-max" value="0" max="100" step="1" />
                                <span>%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>EV / EBIT:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Max:</span>
                                <input type="number" id="ev-to-ebit-max" value="10" min="0" step="0.1" />
                                <span>×</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Deep Value Flag:</label>
                        <div class="filter-inputs">
                            <div class="checkbox-group">
                                <input type="checkbox" id="deep-value-flag" />
                                <span>Price ≤ 0.66 × Net Current Asset Value</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <h3>Moat Tagging</h3>
                <div class="filter-group">
                    <div class="filter-row">
                        <label>Automated NLP Scan:</label>
                        <div class="filter-inputs">
                            <div class="checkbox-group">
                                <input type="checkbox" id="moat-tagging" />
                                <span>Tag stocks with moat indicators</span>
                            </div>
                        </div>
                    </div>
                    <div class="filter-note">
                        <p>Scans 10-K and earnings calls for terms like:</p>
                        <ul>
                            <li>Niche / Cost Edge: "sole supplier", "patented", "low-cost producer"</li>
                            <li>Switching Costs: "long-term contract", "low churn"</li>
                            <li>Brand: "premium pricing", "loyal customer base"</li>
                        </ul>
                    </div>
                </div>
                
                <h3>Other Required Checks</h3>
                <div class="filter-group">
                    <div class="filter-row">
                        <label>Insider Ownership:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min:</span>
                                <input type="number" id="insider-ownership-min" value="8" min="0" step="1" />
                                <span>%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Insider Buying:</label>
                        <div class="filter-inputs">
                            <div class="checkbox-group">
                                <input type="checkbox" id="insider-buyers" />
                                <span>Net buyers in past 12 months</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Gross Margin:</label>
                        <div class="filter-inputs">
                            <div class="checkbox-group">
                                <input type="checkbox" id="gross-margin-decline" checked />
                                <span>No decline from 2021-2023</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Incremental ROIC:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Min:</span>
                                <input type="number" id="incremental-roic-min" value="15" min="0" step="1" />
                                <span>%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>Audit Warnings:</label>
                        <div class="filter-inputs">
                            <div class="checkbox-group">
                                <input type="checkbox" id="audit-warnings" checked />
                                <span>No audit warnings</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-row">
                        <label>C-Suite Departures:</label>
                        <div class="filter-inputs">
                            <div class="input-group">
                                <span>Max:</span>
                                <input type="number" id="csuite-departures" value="1" min="0" step="1" />
                            </div>
                            <span class="filter-note">(in past 12 months)</span>
                        </div>
                    </div>
                </div>
                
                <h3>Scoring System</h3>
                <div class="filter-group">
                    <div class="filter-note">
                        <p>Stocks are scored (0-100) based on:</p>
                        <ul>
                            <li>35%: Owner Earnings Yield</li>
                            <li>20%: 5-Year ROTCE</li>
                            <li>15%: Net Cash / Market Cap</li>
                            <li>15%: Insider Buys</li>
                            <li>15%: Revenue CAGR</li>
                        </ul>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button id="apply-advanced-filters" class="primary-button">Apply Filters</button>
                    <button id="reset-advanced-filters" class="secondary-button">Reset to Defaults</button>
                </div>
            </div>
        `;
        
        // Add styles
        this.addStyles();
    }
    
    addStyles() {
        // Check if styles already exist
        if (document.getElementById('advanced-filters-styles')) return;
        
        // Create style element
        const style = document.createElement('style');
        style.id = 'advanced-filters-styles';
        style.textContent = `
            .advanced-filters {
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .advanced-filters h3 {
                margin: 15px 0 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #e1e4e8;
                color: #0066ff;
            }
            
            .advanced-filters .filter-group {
                margin-bottom: 15px;
            }
            
            .advanced-filters .filter-row {
                display: flex;
                margin-bottom: 10px;
                align-items: center;
            }
            
            .advanced-filters label {
                flex: 0 0 200px;
                font-weight: 500;
            }
            
            .advanced-filters .filter-inputs {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .advanced-filters .input-group {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .advanced-filters input[type="number"] {
                width: 80px;
                padding: 5px;
                border: 1px solid #e1e4e8;
                border-radius: 4px;
            }
            
            .advanced-filters .checkbox-group {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .advanced-filters .filter-note {
                font-size: 0.9em;
                color: #666;
                margin-top: 5px;
            }
            
            .advanced-filters .filter-note ul {
                margin: 5px 0 5px 20px;
            }
            
            .advanced-filters .filter-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            
            .advanced-filters .primary-button {
                padding: 8px 16px;
                background-color: #0066ff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .advanced-filters .secondary-button {
                padding: 8px 16px;
                background-color: #f8f9fa;
                color: #333;
                border: 1px solid #e1e4e8;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .advanced-filters .primary-button:hover {
                background-color: #0055cc;
            }
            
            .advanced-filters .secondary-button:hover {
                background-color: #e9ecef;
            }
        `;
        
        // Append to document head
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Get apply and reset buttons
        const applyButton = document.getElementById('apply-advanced-filters');
        const resetButton = document.getElementById('reset-advanced-filters');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.updateFiltersFromInputs();
                this.onFilterChange(this.filters);
            });
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    }
    
    updateFiltersFromInputs() {
        // Market Cap
        const marketCapMin = document.getElementById('market-cap-min');
        const marketCapMax = document.getElementById('market-cap-max');
        if (marketCapMin) this.filters.marketCapMin = Number(marketCapMin.value) * 1000000; // Convert M to actual value
        if (marketCapMax) this.filters.marketCapMax = Number(marketCapMax.value) * 1000000000; // Convert B to actual value
        
        // Trading Volume
        const tradingVolumeMin = document.getElementById('trading-volume-min');
        if (tradingVolumeMin) this.filters.tradingVolumeMin = Number(tradingVolumeMin.value) * 1000; // Convert K to actual value
        
        // Debt to EBITDA
        const debtToEbitdaMax = document.getElementById('debt-to-ebitda-max');
        if (debtToEbitdaMax) this.filters.debtToEbitdaMax = Number(debtToEbitdaMax.value);
        
        // ROTCE
        const rotceMin = document.getElementById('rotce-min');
        if (rotceMin) this.filters.rotceMin = Number(rotceMin.value);
        
        // FCF to Income
        const fcfToIncomeMin = document.getElementById('fcf-to-income-min');
        if (fcfToIncomeMin) this.filters.fcfToIncomeMin = Number(fcfToIncomeMin.value);
        
        // Share Count CAGR
        const shareCountCagrMax = document.getElementById('share-count-cagr-max');
        if (shareCountCagrMax) this.filters.shareCountCagrMax = Number(shareCountCagrMax.value);
        
        // EV to EBIT
        const evToEbitMax = document.getElementById('ev-to-ebit-max');
        if (evToEbitMax) this.filters.evToEbitMax = Number(evToEbitMax.value);
        
        // Deep Value Flag
        const deepValueFlag = document.getElementById('deep-value-flag');
        if (deepValueFlag) this.filters.deepValueFlag = deepValueFlag.checked;
        
        // Moat Tagging
        const moatTagging = document.getElementById('moat-tagging');
        if (moatTagging) this.filters.moatTagging = moatTagging.checked;
        
        // Insider Ownership
        const insiderOwnershipMin = document.getElementById('insider-ownership-min');
        if (insiderOwnershipMin) this.filters.insiderOwnershipMin = Number(insiderOwnershipMin.value);
        
        // Insider Buyers
        const insiderBuyers = document.getElementById('insider-buyers');
        if (insiderBuyers) this.filters.insiderBuyers = insiderBuyers.checked;
        
        // Gross Margin Decline
        const grossMarginDecline = document.getElementById('gross-margin-decline');
        if (grossMarginDecline) this.filters.grossMarginDecline = grossMarginDecline.checked;
        
        // Incremental ROIC
        const incrementalRoicMin = document.getElementById('incremental-roic-min');
        if (incrementalRoicMin) this.filters.incrementalRoicMin = Number(incrementalRoicMin.value);
        
        // Audit Warnings
        const auditWarnings = document.getElementById('audit-warnings');
        if (auditWarnings) this.filters.auditWarnings = auditWarnings.checked;
        
        // C-Suite Departures
        const cSuiteDepartures = document.getElementById('csuite-departures');
        if (cSuiteDepartures) this.filters.cSuiteDepartures = Number(cSuiteDepartures.value);
    }
    
    resetFilters() {
        // Reset to default values
        this.filters = {
            marketCapMin: 15000000,
            marketCapMax: 5000000000000,
            tradingVolumeMin: 50000,
            debtToEbitdaMax: 1,
            rotceMin: 12,
            fcfToIncomeMin: 80,
            shareCountCagrMax: 0,
            evToEbitMax: 10,
            deepValueFlag: false,
            moatTagging: false,
            insiderOwnershipMin: 8,
            insiderBuyers: false,
            grossMarginDecline: false,
            incrementalRoicMin: 15,
            auditWarnings: false,
            cSuiteDepartures: 1
        };
        
        // Update UI
        this.updateInputsFromFilters();
        
        // Notify change
        this.onFilterChange(this.filters);
    }
    
    updateInputsFromFilters() {
        // Market Cap
        const marketCapMin = document.getElementById('market-cap-min');
        const marketCapMax = document.getElementById('market-cap-max');
        if (marketCapMin) marketCapMin.value = this.filters.marketCapMin / 1000000; // Convert to M
        if (marketCapMax) marketCapMax.value = this.filters.marketCapMax / 1000000000; // Convert to B
        
        // Trading Volume
        const tradingVolumeMin = document.getElementById('trading-volume-min');
        if (tradingVolumeMin) tradingVolumeMin.value = this.filters.tradingVolumeMin / 1000; // Convert to K
        
        // Debt to EBITDA
        const debtToEbitdaMax = document.getElementById('debt-to-ebitda-max');
        if (debtToEbitdaMax) debtToEbitdaMax.value = this.filters.debtToEbitdaMax;
        
        // ROTCE
        const rotceMin = document.getElementById('rotce-min');
        if (rotceMin) rotceMin.value = this.filters.rotceMin;
        
        // FCF to Income
        const fcfToIncomeMin = document.getElementById('fcf-to-income-min');
        if (fcfToIncomeMin) fcfToIncomeMin.value = this.filters.fcfToIncomeMin;
        
        // Share Count CAGR
        const shareCountCagrMax = document.getElementById('share-count-cagr-max');
        if (shareCountCagrMax) shareCountCagrMax.value = this.filters.shareCountCagrMax;
        
        // EV to EBIT
        const evToEbitMax = document.getElementById('ev-to-ebit-max');
        if (evToEbitMax) evToEbitMax.value = this.filters.evToEbitMax;
        
        // Deep Value Flag
        const deepValueFlag = document.getElementById('deep-value-flag');
        if (deepValueFlag) deepValueFlag.checked = this.filters.deepValueFlag;
        
        // Moat Tagging
        const moatTagging = document.getElementById('moat-tagging');
        if (moatTagging) moatTagging.checked = this.filters.moatTagging;
        
        // Insider Ownership
        const insiderOwnershipMin = document.getElementById('insider-ownership-min');
        if (insiderOwnershipMin) insiderOwnershipMin.value = this.filters.insiderOwnershipMin;
        
        // Insider Buyers
        const insiderBuyers = document.getElementById('insider-buyers');
        if (insiderBuyers) insiderBuyers.checked = this.filters.insiderBuyers;
        
        // Gross Margin Decline
        const grossMarginDecline = document.getElementById('gross-margin-decline');
        if (grossMarginDecline) grossMarginDecline.checked = this.filters.grossMarginDecline;
        
        // Incremental ROIC
        const incrementalRoicMin = document.getElementById('incremental-roic-min');
        if (incrementalRoicMin) incrementalRoicMin.value = this.filters.incrementalRoicMin;
        
        // Audit Warnings
        const auditWarnings = document.getElementById('audit-warnings');
        if (auditWarnings) auditWarnings.checked = this.filters.auditWarnings;
        
        // C-Suite Departures
        const cSuiteDepartures = document.getElementById('csuite-departures');
        if (cSuiteDepartures) cSuiteDepartures.value = this.filters.cSuiteDepartures;
    }
    
    getFilters() {
        return this.filters;
    }
    
    setFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        this.updateInputsFromFilters();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedFilters;
}
