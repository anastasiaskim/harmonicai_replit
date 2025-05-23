import React from 'react';
import { twMerge } from 'tailwind-merge';

type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  className?: string;
  showValue?: boolean;
  label?: string;
  animated?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  className,
  showValue = false,
  label,
  animated = false,
}) => {
  const variants = {
    primary: 'bg-blue-600 dark:bg-blue-500',
    success: 'bg-green-600 dark:bg-green-500',
    warning: 'bg-yellow-600 dark:bg-yellow-500',
    danger: 'bg-red-600 dark:bg-red-500',
    info: 'bg-indigo-600 dark:bg-indigo-500',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4',
  };

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={twMerge('w-full', className)}>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          {showValue && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className={twMerge(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizes[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={twMerge(
            'transition-all duration-300 ease-in-out',
            variants[variant],
            animated && 'animate-pulse',
            sizes[size]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}; 