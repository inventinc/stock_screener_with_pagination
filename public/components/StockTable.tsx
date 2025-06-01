
import React from 'react';
import { Stock, KeyMetricVisibility, StyleTag, DisplayMetricConfig } from '../types';
import { DISPLAY_METRICS_CONFIG } from '../constants';
import { getTextSimpleScoreColor } from '../services/stockService';

interface StockTableProps {
  stocks: Stock[];
  keyMetricsVisibility: KeyMetricVisibility;
  onRowClick: (stock: Stock) => void;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
}

const StockTable: React.FC<StockTableProps> = ({ stocks, keyMetricsVisibility, onRowClick, watchlist, onToggleWatchlist }) => {
  const headersFromConfig = DISPLAY_METRICS_CONFIG.filter(
    dm => dm.type === 'individual' && (dm.alwaysVisible || keyMetricsVisibility[dm.id as keyof KeyMetricVisibility])
  );
  
  const tableHeaders = [{id: 'watchlistStar', label:'★', alwaysVisible: true, type: 'custom'} as const, ...headersFromConfig];


  if (stocks.length === 0) {
    return <p className="text-center py-8 text-gray-600 dark:text-gray-400">No stocks match the current filters.</p>;
  }
  
  const getPeColorClass = (peRatio?: number | null): string => {
    if (peRatio === null || peRatio === undefined || peRatio <= 0) return '';
    if (peRatio < 15) return 'text-green-600 dark:text-green-400';
    if (peRatio > 25) return 'text-red-600 dark:text-red-400';
    return '';
  };

  return (
    <div className="table-container">
      <table className="min-w-full stock-table">
        <thead>
          <tr>
            {tableHeaders.map(header => (
              <th key={header.id} className={`py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider ${header.id === 'watchlistStar' ? 'w-10 text-center' : ''}`}>
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {stocks.map(stock => {
            const isWatchlisted = watchlist.includes(stock.symbol);
            const handleStarClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                onToggleWatchlist(stock.symbol);
            };

            return (
            <tr 
                key={stock.id} 
                className="hover:bg-gray-100 dark:hover:bg-gray-700" 
                onClick={() => onRowClick(stock)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRowClick(stock)}
            >
              {tableHeaders.map(currentHeader => {
                if (currentHeader.id === 'watchlistStar') {
                    return (
                        <td key={`${stock.id}-star`} className="py-2 px-2 text-center">
                            <button 
                                onClick={handleStarClick}
                                className={`p-1 text-lg rounded-full focus:outline-none ${
                                  isWatchlisted 
                                    ? 'text-yellow-500 hover:text-yellow-400' 
                                    : 'text-gray-400 hover:text-yellow-400 dark:text-gray-500 dark:hover:text-yellow-300'
                                }`}
                                aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                                title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                            >
                                {isWatchlisted ? '★' : '☆'}
                            </button>
                        </td>
                    );
                }

                const headerConfig = currentHeader as DisplayMetricConfig;
                const dataKey = headerConfig.dataKey!; 
                const rawValue = stock[dataKey];
                let cellContent = headerConfig.formatter ? headerConfig.formatter(rawValue) : (rawValue ?? "N/A");
                
                let cellClass = "py-2 px-2 text-sm";
                if (headerConfig.id === 'symbol') cellClass += " font-semibold";
                
                if (headerConfig.id === 'price') {
                    cellClass += ` text-gray-800 dark:text-gray-200 font-semibold`;
                }
                if (headerConfig.id === 'simpleScore') {
                    cellClass += ` ${getTextSimpleScoreColor(stock.simpleScore)}`;
                }
                if (headerConfig.dataKey === 'peRatioTTM') { 
                    cellClass += ` ${getPeColorClass(stock.peRatioTTM)}`;
                }
                
                let nameSuffix = '';
                if (headerConfig.id === 'name' && stock.styleTags?.includes('highPE')) {
                    nameSuffix = ` <span class="ml-1 text-xs bg-orange-100 text-orange-700 px-1 rounded-full dark:bg-orange-700 dark:text-orange-100">High P/E</span>`;
                }
                if (headerConfig.id === 'name' && stock.styleTags?.includes(' profitableTTM')) {
                     nameSuffix += ` <span class="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded-full dark:bg-green-700 dark:text-green-100">Profitable</span>`;
                }

                return (
                  <td key={`${stock.id}-${headerConfig.id}`} className={cellClass}>
                    <span dangerouslySetInnerHTML={{ __html: `${cellContent}${nameSuffix}` }} />
                  </td>
                );
              })}
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

export default StockTable;
