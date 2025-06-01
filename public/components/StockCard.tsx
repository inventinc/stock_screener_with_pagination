
import React from 'react';
import { Stock, KeyMetricVisibility, StyleTag } from '../types';
import { DISPLAY_METRICS_CONFIG } from '../constants';
import { getSimpleScoreColor, getTextSimpleScoreColor } from '../services/stockService'; // Re-added for simpleScore

interface StockCardProps {
  stock: Stock;
  keyMetricsVisibility: KeyMetricVisibility;
  onCardClick: (stock: Stock) => void;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
}

const StockCard: React.FC<StockCardProps> = ({ stock, keyMetricsVisibility, onCardClick, watchlist, onToggleWatchlist }) => {
  const scoreClass = getSimpleScoreColor(stock.simpleScore);
  const priceAndScoreColor = getTextSimpleScoreColor(stock.simpleScore);

  const individualMetricsToShow = DISPLAY_METRICS_CONFIG.filter(
    dm => dm.type === 'individual' && 
          dm.dataKey &&
          !dm.alwaysVisible && 
          keyMetricsVisibility[dm.id as keyof KeyMetricVisibility] 
  );

  const isWatchlisted = watchlist.includes(stock.symbol);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when star is clicked
    onToggleWatchlist(stock.symbol);
  };
  
  const renderStyleTags = (tags?: StyleTag[]) => {
    if (!tags || tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1 mb-2">
        {tags.map(tag => {
          let bgColor = 'bg-gray-200 dark:bg-gray-700';
          let textColor = 'text-gray-700 dark:text-gray-200';
          if (tag === 'highPE') {
            bgColor = 'bg-orange-100 dark:bg-orange-700';
            textColor = 'text-orange-700 dark:text-orange-100';
          } else if (tag === ' profitableTTM') {
            bgColor = 'bg-green-100 dark:bg-green-700';
            textColor = 'text-green-700 dark:text-green-100';
          }
          return (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${bgColor} ${textColor}`}>
              {tag === 'highPE' ? 'High P/E' : tag === ' profitableTTM' ? 'Profitable (TTM)' : tag}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="stock-card" onClick={() => onCardClick(stock)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onCardClick(stock)}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-xl font-bold text-gray-900">{stock.symbol}</div>
        <div className="flex flex-col items-end">
            {keyMetricsVisibility.price && (
              <div className={`text-lg font-semibold ${priceAndScoreColor}`}>
                ${stock.price ? stock.price.toFixed(2) : 'N/A'}
              </div>
            )}
            {keyMetricsVisibility.simpleScore && 
                <span className={`mt-1 score-badge flex items-center justify-center rounded-full text-sm ${scoreClass} w-8 h-8`}>{stock.simpleScore ?? 'N/A'}</span>
            }
        </div>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-gray-600 mb-1 text-sm truncate" title={stock.name}>{stock.name}</p>
        <button 
            onClick={handleStarClick} 
            className={`p-1 rounded-full text-xl focus:outline-none ${
              isWatchlisted 
                ? 'text-yellow-500 hover:text-yellow-400' 
                : 'text-gray-400 hover:text-yellow-400 dark:text-gray-500 dark:hover:text-yellow-300'
            }`}
            aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
            title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
        >
            {isWatchlisted ? '★' : '☆'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">{stock.sector}</p>
      {renderStyleTags(stock.styleTags)}
      
      <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
        {individualMetricsToShow.map(metric => {
           if (!metric.dataKey || metric.id === 'simpleScore') return null;
           let value = stock[metric.dataKey as keyof Stock] as string | number | undefined | null;
           if (metric.formatter) {
             value = metric.formatter(value);
           } else if (typeof value === 'number') {
             value = value.toString();
           } else if (value === null || value === undefined) {
             value = "N/A";
           }
           
           return (
            <div key={metric.id} className="flex flex-col">
              <span className="text-gray-500 text-xs">{metric.label}</span>
              <span className="font-medium text-gray-800 text-sm">{value}</span>
            </div>
           );
        })}
      </div>
    </div>
  );
};

export default StockCard;
