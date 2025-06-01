
import React from 'react';
import { Stock } from '../types';
import { CloseIcon } from './icons';
import { getSimpleScoreColor } from '../services/stockService';

interface WatchlistPaneProps {
  isOpen: boolean;
  onClose: () => void;
  watchlistSymbols: string[];
  allStocks: Stock[];
  onStockClick: (stock: Stock) => void;
  onToggleWatchlist: (symbol: string) => void;
}

const WatchlistPane: React.FC<WatchlistPaneProps> = ({ 
    isOpen, 
    onClose, 
    watchlistSymbols, 
    allStocks, 
    onStockClick, 
    onToggleWatchlist 
}) => {
  if (!isOpen) return null;

  const watchlistStocks = watchlistSymbols.map(symbol => 
    allStocks.find(stock => stock.symbol === symbol)
  ).filter(stock => stock !== undefined) as Stock[];

  return (
    <div 
        className="fixed inset-0 bg-gray-800 bg-opacity-75 z-40 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 shadow-xl p-4 transform transition-transform duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">★ My Watchlist</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
            aria-label="Close watchlist"
          >
            <CloseIcon className="w-5 h-5"/>
          </button>
        </div>

        {watchlistStocks.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">Your watchlist is empty. Star stocks to add them here.</p>
        )}

        <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-100px)] pr-1">
          {watchlistStocks.map(stock => (
            <li 
              key={stock.symbol} 
              className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
              onClick={() => { onStockClick(stock); onClose();}}
            >
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">{stock.symbol}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{stock.name}</p>
              </div>
              <div className="flex items-center space-x-2">
                 {stock.price && <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">${stock.price.toFixed(2)}</span>}
                 {stock.simpleScore !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getSimpleScoreColor(stock.simpleScore)}`}>{stock.simpleScore}</span>
                 )}
                 <button 
                    onClick={(e) => {e.stopPropagation(); onToggleWatchlist(stock.symbol);}}
                    className="text-yellow-500 hover:text-yellow-400 text-xl opacity-75 group-hover:opacity-100 focus:outline-none"
                    title="Remove from watchlist"
                 >
                    ★
                 </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WatchlistPane;
