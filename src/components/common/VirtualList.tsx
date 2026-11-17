import React, { useState, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  viewportHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
}

/**
 * Virtualizador de listas largas sin dependencias pesadas.
 * Renderiza únicamente las filas visibles en el viewport + overscan,
 * manteniendo 60 FPS incluso con miles de lecturas de sensores.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  viewportHeight,
  overscan = 4,
  renderItem,
  keyExtractor,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const total = items.length * rowHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(items.length - 1, start + visibleCount);
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: total,
      offsetY: start * rowHeight,
    };
  }, [items.length, rowHeight, viewportHeight, overscan, scrollTop]);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex + 1),
    [items, startIndex, endIndex]
  );

  return (
    <div
      onScroll={onScroll}
      style={{ height: Math.min(viewportHeight, Math.max(rowHeight * 2, totalHeight)) }}
      className="overflow-y-auto relative w-full"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <div key={keyExtractor(item, actualIndex)} style={{ height: rowHeight }}>
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

