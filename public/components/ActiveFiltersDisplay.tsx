
import React from 'react';
import { ActiveFilters, FilterGroupDef, FilterOption } from '../types';
import { FILTER_GROUPS } from '../constants';
import { CloseIcon } from './icons';

interface ActiveFiltersDisplayProps {
  activeFilters: ActiveFilters;
  onRemoveFilter: (group: string) => void;
}

const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({ activeFilters, onRemoveFilter }) => {
  const getFilterLabel = (groupKey: string, value: string): string => {
    for (const group of FILTER_GROUPS) {
        if (group.subGroups) {
            for (const subGroup of group.subGroups) {
                if (subGroup.id === groupKey) {
                    const option = subGroup.options.find(opt => opt.value === value);
                    return option ? option.label : value;
                }
            }
        }
    }
    return value;
  };
  
  const filtersToDisplay = Object.entries(activeFilters)
    .filter(([_, value]) => value !== undefined && value !== '');

  if (filtersToDisplay.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3" id="activeFiltersContainer">
      {filtersToDisplay.map(([group, value]) => (
        <span 
          key={group}
          className="flex items-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs font-medium px-2.5 py-1 rounded-full"
        >
          {getFilterLabel(group, value!)}
          <button 
            className="ml-1.5 text-blue-800 dark:text-blue-100 hover:text-blue-900 dark:hover:text-blue-50 focus:outline-none"
            onClick={() => onRemoveFilter(group)}
            aria-label={`Remove ${getFilterLabel(group, value!)} filter`}
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

export default ActiveFiltersDisplay;
    