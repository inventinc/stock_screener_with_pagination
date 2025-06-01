
import React, { useState } from 'react';
import { ActiveFilters, FilterGroupDef, Preset as PresetType, FilterOption, SubFilterGroupDef } from '../types';
import { FILTER_GROUPS, PRESETS } from '../constants';
import Accordion from './Accordion';
import FilterButton from './FilterButton';
import PresetCard from './PresetCard';
import { CloseIcon } from './icons';

interface SidebarProps {
  activeFilters: ActiveFilters;
  onFilterChange: (group: string, value: string) => void;
  onClearAllFilters: () => void;
  onApplyPreset: (filters: ActiveFilters) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenPresetWizard: () => void; // New
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeFilters, 
  onFilterChange, 
  onClearAllFilters, 
  onApplyPreset,
  isOpen,
  onClose,
  onOpenPresetWizard
}) => {
  
  const [sliderValues, setSliderValues] = useState<{[key: string]: number}>({});

  const handleSliderChange = (groupName: string, value: string) => {
    const numericValue = Number(value);
    setSliderValues(prev => ({ ...prev, [groupName]: numericValue }));
    // Potentially call onFilterChange if slider interaction should immediately filter
    // For now, it just updates local state for display.
    // onFilterChange(groupName, String(numericValue)); 
  };

  const renderFilterOptions = (groupDef: FilterGroupDef | SubFilterGroupDef) => {
    const groupName = groupDef.id;
    const options = groupDef.options;

    if (groupDef.controlType === 'slider' && 'sliderMin' in groupDef && 'sliderMax' in groupDef) {
      const currentValue = sliderValues[groupName] ?? groupDef.sliderDefault ?? groupDef.sliderMin;
      return (
         <div>
          {groupDef.tooltip && <span className="ml-1 text-gray-400 cursor-help" title={groupDef.tooltip}>&#9432;</span>}
          <input 
            type="range"
            min={groupDef.sliderMin}
            max={groupDef.sliderMax}
            step={groupDef.sliderStep ?? 1}
            value={currentValue}
            onChange={(e) => handleSliderChange(groupName, e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">{currentValue} {groupName === 'liquiditySafety' ? 'Days' : ''}</div>
        </div>
      );
    }
    
    if (groupDef.controlType === 'checkboxes' && options) {
        return (
            <ul className="space-y-1">
                {options.map(opt => (
                    <li key={opt.value} className="flex items-center">
                        <input 
                            type="checkbox" 
                            id={`${groupName}-${opt.value}`} 
                            name={groupName} 
                            value={opt.value}
                            checked={activeFilters[groupName] === opt.value} // Simple selection, could be multi-select
                            onChange={() => onFilterChange(groupName, opt.value)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                        />
                        <label htmlFor={`${groupName}-${opt.value}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">{opt.label}</label>
                    </li>
                ))}
            </ul>
        );
    }


    if (!options || options.length === 0) return null;

    const isMarketCapGroup = groupName === 'marketCap';

    let containerClassName: string;
    let buttonClassName: string = ''; 

    if (isMarketCapGroup) {
      containerClassName = 'grid grid-cols-1 gap-2 text-sm';
      // Apply w-full for consistent width, h-14 for consistent height, and flex utilities for centering content.
      buttonClassName = 'w-full h-14 flex items-center justify-center'; 
    } else {
      const defaultGridColsClass = 'grid-cols-2'; 
      const specificGridColsClass = (groupDef.id.startsWith("capitalStructure") || groupDef.id.startsWith("valuation")) 
                                   ? 'grid-cols-1 sm:grid-cols-2' 
                                   : defaultGridColsClass;
      containerClassName = `grid ${specificGridColsClass} gap-2 text-sm`;
    }

    return (
      <div className={containerClassName}>
        {options.map(opt => (
          <FilterButton
            key={opt.value}
            group={groupName}
            value={opt.value}
            label={opt.label}
            isActive={activeFilters[groupName] === opt.value}
            onClick={onFilterChange}
            className={buttonClassName} 
          />
        ))}
      </div>
    );
  };


  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="sidebar-internal-header flex items-center justify-between mb-2 pb-2 border-b">
        <h3 className="text-xl font-semibold">Filters</h3>
        <div className="flex items-center">
          <button 
            className="text-sm text-blue-600 hover:underline mr-3" 
            onClick={onClearAllFilters}
          >
            Clear All
          </button>
          <button onClick={onClose} className="mobile-sidebar-close-btn" aria-label="Close filters">
             <CloseIcon />
          </button>
        </div>
      </div>
      <div className="sidebar-scroll-container sidebar-scroll">
        <div className="mb-4">
            <button 
                onClick={onOpenPresetWizard}
                className="w-full filter-btn bg-green-500 hover:bg-green-600 text-white text-sm"
            >
                ✨ Guided Setup Wizard
            </button>
        </div>

        {FILTER_GROUPS.map(group => (
          <Accordion key={group.id} title={group.title} emoji={group.emoji} initiallyOpen={group.id === 'companySizeAndLiquidity'}>
            {group.subGroups?.map(subGroup => (
               <div key={subGroup.id} className="mb-4">
                <label className="block text-sm font-medium mb-1">
                    {subGroup.title}
                    {subGroup.tooltip && <span className="ml-1 text-gray-400 cursor-help" title={subGroup.tooltip}>&#9432;</span>}
                </label>
                {renderFilterOptions(subGroup)}
               </div>
            ))}
            {group.options && group.controlType === 'checkboxes' && ( // For groups like Catalysts with direct options
                 <div className="mb-4">
                    {renderFilterOptions(group)}
                 </div>
            )}
          </Accordion>
        ))}
        <Accordion title="Presets" emoji="🎯">
          <div className="space-y-4">
            {PRESETS.map(preset => (
              <PresetCard key={preset.id} preset={preset} onApplyPreset={onApplyPreset} />
            ))}
          </div>
        </Accordion>
        <Accordion title="Advanced Tools" emoji="🛠️">
            <button 
                disabled 
                className="w-full filter-btn opacity-50 cursor-not-allowed text-sm"
                title="Backtesting requires backend processing."
            >
                Backtest This Screen
            </button>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                (Backend required for backtesting)
            </div>
             {/* Placeholder for "Set Alert" button */}
             <button 
                disabled 
                className="w-full filter-btn opacity-50 cursor-not-allowed text-sm mt-2"
                title="Alerts require backend implementation."
            >
                Set Alert For Screen
            </button>
             <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                (Backend required for alerts)
            </div>
        </Accordion>
      </div>
    </aside>
  );
};

export default Sidebar;
