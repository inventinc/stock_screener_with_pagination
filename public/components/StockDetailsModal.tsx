
import React, { useEffect, useRef } from 'react';
import { StockDetails, TopInstitutionalHolder } from '../types'; // Added TopInstitutionalHolder
import { formatMarketCap, getTextSimpleScoreColor, getSimpleScoreColor } from '../services/stockService';
import { CloseIcon } from './icons';
import { Chart, registerables } from 'chart.js'; // Using specific version from CDN, but good practice to import for type safety if using npm.

Chart.register(...registerables); // Register all components for Chart.js

interface StockDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockDetails: StockDetails | null;
  isLoading: boolean;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
}

const DetailItem: React.FC<{ label: string; value: string | number | undefined | null; id?: string; className?: string }> = ({ label, value, id, className="" }) => (
  <div className={`flex flex-col ${className} break-words`}>
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-medium text-gray-800 dark:text-gray-200" id={id}>{value ?? 'N/A'}</span>
  </div>
);


const StockDetailsModal: React.FC<StockDetailsModalProps> = ({ isOpen, onClose, stockDetails, isLoading, watchlist, onToggleWatchlist }) => {
  const priceChartRef = useRef<HTMLCanvasElement>(null);
  const financialsChartRef = useRef<HTMLCanvasElement>(null);
  const priceChartInstanceRef = useRef<Chart | null>(null);
  const financialsChartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!isOpen || !stockDetails || isLoading) {
      return;
    }
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#CBD5E0' : '#4A5568'; // Tailwind gray-400 and gray-700

    // Destroy existing charts before creating new ones
    if (priceChartInstanceRef.current) {
        priceChartInstanceRef.current.destroy();
    }
    if (financialsChartInstanceRef.current) {
        financialsChartInstanceRef.current.destroy();
    }

    // 90-day Price Trend Chart
    if (priceChartRef.current && stockDetails.historicalPriceData && stockDetails.historicalPriceData.length > 0) {
      const labels = stockDetails.historicalPriceData.map(d => d.date);
      const data = stockDetails.historicalPriceData.map(d => d.close);

      priceChartInstanceRef.current = new Chart(priceChartRef.current, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Price',
            data: data,
            borderColor: '#3B82F6', // Blue-500
            borderWidth: 2,
            pointRadius: 0, // No points for sparkline feel
            tension: 0.1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { 
                display: false, // Sparkline-like
                grid: { display: false } 
            },
            y: { 
                display: false, // Sparkline-like
                grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        return `Price: $${Number(context.raw).toFixed(2)}`;
                    }
                }
            }
          }
        }
      });
    }

    // 10-year Share Count & ROTCE Chart
    if (financialsChartRef.current && stockDetails.historicalFinancials && stockDetails.historicalFinancials.length > 0) {
      const financialLabels = stockDetails.historicalFinancials.map(f => f.year.toString());
      const shareCountData = stockDetails.historicalFinancials.map(f => f.commonStockSharesOutstanding ? f.commonStockSharesOutstanding / 1000000 : null); // In Millions
      const rotceData = stockDetails.historicalFinancials.map(f => f.calculatedROTCE !== null && f.calculatedROTCE !== undefined ? f.calculatedROTCE * 100 : null); // As Percentage

      financialsChartInstanceRef.current = new Chart(financialsChartRef.current, {
        type: 'bar', // Base type, will add line dataset
        data: {
          labels: financialLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Share Count (Millions)',
              data: shareCountData,
              backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.5)', // Blue
              borderColor: isDarkMode ? '#3B82F6' : '#2563EB',
              yAxisID: 'yShareCount',
              order: 2
            },
            {
              type: 'line',
              label: 'ROTCE (%)',
              data: rotceData,
              borderColor: isDarkMode ? '#F59E0B' : '#D97706', // Amber/Orange
              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.5)' : 'rgba(217, 119, 6, 0.5)',
              borderWidth: 2,
              pointRadius: 3,
              tension: 0.1,
              yAxisID: 'yROTCE',
              order: 1,
              fill: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: gridColor, display: false },
              ticks: { color: textColor, font: { size: 10 } }
            },
            yShareCount: {
              type: 'linear',
              position: 'left',
              title: { display: true, text: 'Share Count (M)', color: textColor, font: { size: 10 } },
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 10 }, callback: (value) => `${value}M` }
            },
            yROTCE: {
              type: 'linear',
              position: 'right',
              title: { display: true, text: 'ROTCE (%)', color: textColor, font: { size: 10 } },
              grid: { display: false }, // No grid lines for the right axis
              ticks: { color: textColor, font: { size: 10 }, callback: (value) => `${value}%` }
            }
          },
          plugins: {
            legend: { 
                display: true, 
                position: 'bottom',
                labels: { color: textColor, font: {size: 10}}
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            if (context.dataset.yAxisID === 'yROTCE') {
                                label += Number(context.parsed.y).toFixed(1) + '%';
                            } else {
                                label += Number(context.parsed.y).toFixed(1) + 'M';
                            }
                        }
                        return label;
                    }
                }
            }
          }
        }
      });
    }
    
    return () => {
      if (priceChartInstanceRef.current) {
        priceChartInstanceRef.current.destroy();
        priceChartInstanceRef.current = null;
      }
      if (financialsChartInstanceRef.current) {
        financialsChartInstanceRef.current.destroy();
        financialsChartInstanceRef.current = null;
      }
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stockDetails, isLoading]); 


  if (!isOpen) return null;

  const priceAndScoreColor = stockDetails ? getTextSimpleScoreColor(stockDetails.simpleScore) : '';
  const scoreBadgeColor = stockDetails ? getSimpleScoreColor(stockDetails.simpleScore) : '';
  const isWatchlisted = stockDetails ? watchlist.includes(stockDetails.symbol) : false;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stockDetails) {
      onToggleWatchlist(stockDetails.symbol);
    }
  };
  
  const handleExportCsv = () => {
    if (!stockDetails) return;
    const headers = "Symbol,Name,Price,P/E_TTM,ROE_TTM,Simple_Score\n";
    const row = [
      stockDetails.symbol,
      `"${stockDetails.name.replace(/"/g, '""')}"`, 
      stockDetails.price,
      stockDetails.peRatioTTM ?? 'N/A',
      stockDetails.returnOnEquityTTM ?? 'N/A',
      stockDetails.simpleScore ?? 'N/A'
    ].join(',');
    const csvContent = "data:text/csv;charset=utf-8," + encodeURI(headers + row);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${stockDetails.symbol}_metrics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  let intrinsicValueDisplay = <DetailItem label="Owner Earnings x10 (FCF Proxy)" value="N/A" />;
  if (stockDetails && stockDetails.freeCashFlowPerShareTTM !== null && stockDetails.freeCashFlowPerShareTTM !== undefined) {
    const fcf = stockDetails.freeCashFlowPerShareTTM;
    const ownerEarnings10x = fcf * 10;
    const lowerBand = ownerEarnings10x * 0.7;
    const upperBand = ownerEarnings10x * 1.3;
    intrinsicValueDisplay = (
      <div className="flex flex-col">
        <span className="text-sm text-gray-500 dark:text-gray-400">Owner Earnings x10 (FCF Proxy)</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">
          ${ownerEarnings10x.toFixed(2)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Bands: ${lowerBand.toFixed(2)} - ${upperBand.toFixed(2)}
        </span>
      </div>
    );
  }

  let liquidityEstimateDisplay = <DetailItem label="Days to trade $10k (10% ADV)" value="N/A" />;
  if (stockDetails && stockDetails.avgVolume && stockDetails.price && stockDetails.avgVolume > 0 && stockDetails.price > 0) {
      const tradeAmount = 10000;
      const maxDailyVolumeShare = 0.10;
      const dailyTradeableValue = stockDetails.avgVolume * stockDetails.price * maxDailyVolumeShare;
      const daysToTrade = dailyTradeableValue > 0 ? (tradeAmount / dailyTradeableValue).toFixed(1) : "N/A";
      liquidityEstimateDisplay = <DetailItem label="Days to trade $10k (10% ADV)" value={`${daysToTrade} days`} />;
  }

  let keywordHitsDisplay = null;
  if (stockDetails && stockDetails.description) {
    const desc = stockDetails.description.toLowerCase();
    const brandCount = (desc.match(/brand/gi) || []).length;
    const networkCount = (desc.match(/network effect/gi) || []).length;
    keywordHitsDisplay = (
        <>
            <DetailItem label="'Brand' Mentions" value={brandCount} />
            <DetailItem label="'Network Effect' Mentions" value={networkCount} />
        </>
    );
  }


  return (
    <div className="modal-overlay" style={{ display: 'flex' }} aria-modal="true" role="dialog">
      <div className="modal-content-inner modal-content-bg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        {isLoading && <p className="text-center text-gray-700 dark:text-gray-300 py-10">Loading details...</p>}
        {!isLoading && !stockDetails && <p className="text-center text-red-500 py-10">Failed to load stock details.</p>}
        
        {!isLoading && stockDetails && (
          <>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold flex items-center" id="detailStockSymbol">
                  {stockDetails.symbol}
                  <button 
                    onClick={handleStarClick} 
                    className={`ml-3 p-1 rounded-full text-2xl focus:outline-none ${
                      isWatchlisted 
                        ? 'text-yellow-500 hover:text-yellow-400' 
                        : 'text-gray-400 hover:text-yellow-400 dark:text-gray-500 dark:hover:text-yellow-300'
                    }`}
                    aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                    title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    {isWatchlisted ? '★' : '☆'}
                  </button>
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400" id="detailStockName">{stockDetails.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500" id="detailStockSector">{stockDetails.sector} {stockDetails.industry && `- ${stockDetails.industry}`}</p>
              </div>
              <button 
                className="text-2xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none p-1" 
                onClick={onClose}
                aria-label="Close stock details"
              >
                <CloseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            {stockDetails.image && <img src={stockDetails.image} alt={`${stockDetails.name} logo`} className="w-12 h-12 sm:w-16 sm:h-16 mb-3 rounded-full object-contain border border-gray-200 dark:border-gray-700" onError={(e) => (e.currentTarget.style.display = 'none')} />}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
              <DetailItem label="Price" value={stockDetails.price ? `$${stockDetails.price.toFixed(2)}` : 'N/A'} id="detailStockPrice" className={`text-lg font-bold ${priceAndScoreColor}`} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">Score</span>
                <span className={`font-medium text-lg ${priceAndScoreColor} ${scoreBadgeColor} px-2 py-0.5 rounded-md self-start`}>{stockDetails.simpleScore ?? 'N/A'}</span>
              </div>
            </div>

            {stockDetails.website && <p className="text-sm mb-4"><a href={stockDetails.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Visit Website</a></p>}
            
            <div className="space-y-5">
                <div>
                    <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Description</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-h-16 overflow-y-auto" id="detailStockDescription">{stockDetails.description || "No description available."}</p>
                </div>

                <div>
                    <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Key Financials</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                      {[
                        { label: "Market Cap", value: formatMarketCap(stockDetails.marketCap), id: "detailMarketCap" },
                        { label: "P/E Ratio (TTM)", value: stockDetails.peRatioTTM?.toFixed(2) ?? "N/A", id: "detailPERatio" },
                        { label: "Div Yield", value: stockDetails.dividendYield, id: "detailDividendYield" },
                        { label: "52W High", value: stockDetails['52WeekHigh'], id: "detail52WeekHigh" },
                        { label: "52W Low", value: stockDetails['52WeekLow'], id: "detail52WeekLow" },
                        { label: "Debt/Equity (TTM)", value: stockDetails.debtEquityRatioTTM?.toFixed(2) ?? "N/A" },
                        { label: "Debt/EBITDA (TTM)", value: stockDetails.debtEbitda, id: "detailDebtEbitda" },
                        { label: "EV/EBITDA (TTM)", value: stockDetails.evEbit, id: "detailEvEbit" },
                        { label: "FCF/NI (TTM)", value: stockDetails.fcfNi, id: "detailFcfNi" },
                        { label: "ROE (TTM)", value: stockDetails.rotce, id: "detailRotce" },
                        { label: "CEO", value: stockDetails.ceo },
                        { label: "Employees", value: stockDetails.fullTimeEmployees ? Number(stockDetails.fullTimeEmployees).toLocaleString() : "N/A" },
                      ].map(item => (
                        <DetailItem key={item.label} label={item.label} value={item.value} id={item.id} />
                      ))}
                    </div>
                </div>

                {/* Institutional Ownership Section */}
                {stockDetails.institutionalOwnershipSummary && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Institutional Ownership</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm mb-2">
                      <DetailItem label="Inst. Own %" value={stockDetails.institutionalOwnershipSummary.institutionalOwnershipPercentage !== null ? `${stockDetails.institutionalOwnershipSummary.institutionalOwnershipPercentage.toFixed(2)}%` : 'N/A'} />
                      <DetailItem label="# Inst. Positions" value={stockDetails.institutionalOwnershipSummary.numberOfInstitutionalPositions?.toLocaleString() ?? 'N/A'} />
                      <DetailItem label="Total Inst. Value" value={stockDetails.institutionalOwnershipSummary.totalInstitutionalValue !== null ? `$${stockDetails.institutionalOwnershipSummary.totalInstitutionalValue.toLocaleString()}` : 'N/A'} />
                      <DetailItem label="Data As Of" value={stockDetails.institutionalOwnershipSummary.date ? new Date(stockDetails.institutionalOwnershipSummary.date).toLocaleDateString() : 'N/A'} />
                    </div>
                    {stockDetails.topInstitutionalHolders && stockDetails.topInstitutionalHolders.length > 0 && (
                      <>
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1">Top Institutional Holders:</h5>
                        <ul className="list-none space-y-1 text-xs max-h-28 overflow-y-auto">
                          {stockDetails.topInstitutionalHolders.map((holder, idx) => (
                            <li key={idx} className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">{holder.holder}</span>: {holder.shares.toLocaleString()} shares
                              (Value: ${((holder.shares * (stockDetails.price || 0))).toLocaleString()})
                              {holder.change ? <span className={`ml-1 ${holder.change > 0 ? 'text-green-500' : 'text-red-500'}`}>({holder.change > 0 ? '+' : ''}{holder.change.toLocaleString()})</span> : ''}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {/* Earnings Call Transcript Link */}
                {stockDetails.latestTranscript && (
                  <div>
                    <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Earnings Call Transcript</h4>
                    <p className="text-sm">
                      <a 
                        href={stockDetails.latestTranscript.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Latest Transcript ({new Date(stockDetails.latestTranscript.date).toLocaleDateString()} - Q{stockDetails.latestTranscript.quarter} {stockDetails.latestTranscript.year})
                      </a>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {intrinsicValueDisplay}
                    {liquidityEstimateDisplay}
                </div>
                 {keywordHitsDisplay && (
                    <div>
                        <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Description Keyword Hits</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                           {keywordHitsDisplay}
                        </div>
                    </div>
                )}


                <div>
                    <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Charts</h4>
                    <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">90-Day Price Trend</h5>
                        <div className="w-full h-32 bg-gray-50 dark:bg-gray-700 rounded-md p-1">
                          {stockDetails.historicalPriceData && stockDetails.historicalPriceData.length > 0 ? (
                            <canvas ref={priceChartRef}></canvas>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-500">Price data not available.</div>
                          )}
                        </div>
                    </div>
                     <div>
                        <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">10-Year Share Count & ROTCE</h5>
                        <div className="w-full h-56 bg-gray-50 dark:bg-gray-700 rounded-md p-1">
                           {stockDetails.historicalFinancials && stockDetails.historicalFinancials.length > 0 ? (
                            <canvas ref={financialsChartRef}></canvas>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-500">Historical financial data not available.</div>
                          )}
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Analyst Notes (UI Mockup)</h4>
                    <textarea className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" rows={2} placeholder="Your notes..."></textarea>
                    <div className="flex items-center mt-1">
                      <span className="text-xs mr-2 text-gray-600 dark:text-gray-400">Conviction:</span>
                      {'★☆☆☆☆'.split('').map((s, i) => <span key={i} className="text-yellow-400 text-xl cursor-pointer hover:text-yellow-300" title={`Rate ${i+1} star${i > 0 ? 's' : ''}`}>{s}</span>)}
                    </div>
                </div>


                <div>
                    <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Latest News</h4>
                    <ul id="detailStockNews" className="list-none space-y-2 text-sm max-h-40 overflow-y-auto">
                      {stockDetails.latestNews && stockDetails.latestNews.length > 0 ? (
                        stockDetails.latestNews.slice(0,3).map((newsItem, index) => (
                          <li key={index} className="pb-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                            <a href={newsItem.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                              {newsItem.title}
                            </a>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">{newsItem.date}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 dark:text-gray-400">No recent news available.</li>
                      )}
                    </ul>
                </div>
                
                <div className="mt-4 text-right">
                    <button 
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                        Export Key Metrics (CSV)
                    </button>
                </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StockDetailsModal;
