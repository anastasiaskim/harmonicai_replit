import React from 'react';
import { twMerge } from 'tailwind-merge';

interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

export const Grid: React.FC<GridProps> = ({
  children,
  className,
  cols = 1,
  gap = 'md',
  responsive = true,
}) => {
  const gaps = {
    none: 'gap-0',
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  const baseCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  const responsiveCols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-1 md:grid-cols-2',
    3: 'sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div
      className={twMerge(
        'grid',
        gaps[gap],
        responsive ? responsiveCols[cols] : baseCols[cols],
        className
      )}
    >
      {children}
    </div>
  );
}; 