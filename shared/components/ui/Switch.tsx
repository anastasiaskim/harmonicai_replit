import React from 'react';
import { twMerge } from 'tailwind-merge';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  className?: string;
  labelClassName?: string;
  size?: SwitchSize;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  error,
  className,
  labelClassName,
  size = 'md',
  disabled,
  required,
  ...props
}) => {
  const sizes = {
    sm: 'h-4 w-7',
    md: 'h-5 w-9',
    lg: 'h-6 w-11',
  };

  const dotSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div className={twMerge('relative flex items-start', className)}>
      <div className="flex h-5 items-center">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          id={props.id}
          {...props}
        />
        <span
          className={twMerge(
            'relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            sizes[size],
            'bg-gray-200 dark:bg-gray-700',
            'peer-checked:bg-blue-600 peer-checked:dark:bg-blue-500',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500'
          )}
        >
          <span
            className={twMerge(
              'pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              dotSizes[size],
              'translate-x-0',
              size === 'sm' && 'peer-checked:translate-x-3',
              size === 'md' && 'peer-checked:translate-x-4',
              size === 'lg' && 'peer-checked:translate-x-5'
            )}
          />
        </span>
      </div>
      {label && (
        <div className="ml-3 text-sm">
          <label
            className={twMerge(
              'font-medium text-gray-700 dark:text-gray-300',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              labelClassName
            )}
            htmlFor={props.id}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {error && (
            <p
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              id={`${props.id}-error`}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}; 