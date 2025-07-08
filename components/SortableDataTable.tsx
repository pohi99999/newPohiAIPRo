// components/SortableDataTable.tsx
import React, { useState, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { useLocale } from '../LocaleContext';

type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  accessorKey: keyof T | string; // Allow dot notation for nested objects
  header: string;
  enableSorting?: boolean;
  cell?: (info: { getValue: () => any; row: { original: T } }) => React.ReactNode;
}

interface SortableDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

// Helper function to get nested property value
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const SortableDataTable = <T extends object>({ columns, data }: SortableDataTableProps<T>) => {
  const { t } = useLocale();
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | string; direction: SortDirection } | null>(null);

  const sortedData = useMemo(() => {
    let sortableData = [...data];
    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key as string);
        const bValue = getNestedValue(b, sortConfig.key as string);
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [data, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (!data || data.length === 0) {
    return (
        <div className="text-center py-6 text-slate-400 bg-slate-800/50 rounded-md">
            <p>{t('sortableTable_noData')}</p>
        </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar shadow-md rounded-lg border border-slate-700">
      <table className="w-full min-w-max text-sm text-left text-slate-300">
        <thead className="text-xs text-slate-300 uppercase bg-slate-700">
          <tr>
            {columns.map((column) => (
              <th key={column.accessorKey as string} scope="col" className="p-4">
                {column.enableSorting ? (
                  <button
                    onClick={() => requestSort(column.accessorKey)}
                    className="flex items-center space-x-1 hover:text-cyan-300 transition-colors duration-150"
                    title={sortConfig?.key === column.accessorKey && sortConfig.direction === 'asc' ? t('sortableTable_sortDesc') : t('sortableTable_sortAsc')}
                  >
                    <span>{column.header}</span>
                    {sortConfig?.key === column.accessorKey ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUpIcon className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-cyan-400" />
                      )
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 opacity-30" />
                    )}
                  </button>
                ) : (
                  <span>{column.header}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, index) => (
            <tr key={index} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50">
              {columns.map((column) => {
                 const value = getNestedValue(item, column.accessorKey as string);
                 const cellContent = column.cell 
                    ? column.cell({ getValue: () => value, row: { original: item } })
                    : value;

                return (
                  <td key={column.accessorKey as string} className="p-4">
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SortableDataTable;