'use client';

import { useState, useCallback, useMemo } from 'react';

export interface UseSelectionProps<T> {
  data: T[];
  getItemId: (item: T) => string;
}

export const useSelection = <T>({ data, getItemId }: UseSelectionProps<T>) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allIds = data.map(getItemId);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [data, getItemId, selectedIds]);

  const selectAll = useCallback(() => {
    const allIds = data.map(getItemId);
    setSelectedIds(new Set(allIds));
  }, [data, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(() => {
    return data.filter(item => selectedIds.has(getItemId(item)));
  }, [data, selectedIds, getItemId]);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const isAllSelected = useMemo(() => {
    if (data.length === 0) return false;
    return data.every(item => selectedIds.has(getItemId(item)));
  }, [data, selectedIds, getItemId]);

  const isPartialSelection = useMemo(() => {
    const hasSelection = selectedIds.size > 0;
    const hasUnselected = data.some(item => !selectedIds.has(getItemId(item)));
    return hasSelection && hasUnselected;
  }, [data, selectedIds, getItemId]);

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isSelected,
    isAllSelected,
    isPartialSelection,
    toggleSelection,
    toggleAll,
    selectAll,
    clearSelection,
  };
};