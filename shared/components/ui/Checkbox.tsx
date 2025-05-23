import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  className?: string;
  labelClassName?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  className,
  labelClassName,
  disabled,
  required,
  ...props
}) => {
  return (
    <div className={twMerge('relative flex items-start', className)}>
      <div className="flex h-5 items-center">
        <input
          type="checkbox"
          className={twMerge(
            'h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:checked:bg-blue-600',
            error && 'border-red-500 focus:ring-red-500',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'checkbox-error' : undefined}
          {...props}
        />
      </div>
      {label && (
        <div className="ml-3 text-sm">
          <label
            className={twMerge(
              'font-medium text-gray-700 dark:text-gray-300',
              disabled && 'cursor-not-allowed opacity-50',
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
              id="checkbox-error"
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