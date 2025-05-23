import React from 'react';
import { twMerge } from 'tailwind-merge';

interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  options: RadioOption[];
  label?: string;
  error?: string;
  className?: string;
  labelClassName?: string;
  orientation?: 'horizontal' | 'vertical';
  id?: string;
  name?: string;
}

export const Radio: React.FC<RadioProps> = ({
  options,
  label,
  error,
  className,
  labelClassName,
  orientation = 'vertical',
  disabled,
  required,
  id,
  name,
  ...props
}) => {
  // Generate a unique ID for the radio group if not provided
  const groupId = id || `radio-group-${Math.random().toString(36).substr(2, 9)}`;
  const groupName = name || groupId;

  return (
    <div className={twMerge('space-y-2', className)}>
      {label && (
        <label
          id={`${groupId}-label`}
          className={twMerge(
            'block text-sm font-medium text-gray-700 dark:text-gray-300',
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div
        className={twMerge(
          'space-y-2',
          orientation === 'horizontal' && 'flex flex-wrap gap-4'
        )}
        role="radiogroup"
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-describedby={error ? `${groupId}-error` : undefined}
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          return (
            <div
              key={option.value}
              className={twMerge(
                'relative flex items-start',
                orientation === 'horizontal' && 'flex-1'
              )}
            >
              <div className="flex h-5 items-center">
                <input
                  type="radio"
                  id={optionId}
                  name={groupName}
                  value={option.value}
                  className={twMerge(
                    'h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:checked:bg-blue-600',
                    error && 'border-red-500 focus:ring-red-500',
                    (disabled || option.disabled) && 'cursor-not-allowed opacity-50'
                  )}
                  disabled={disabled || option.disabled}
                  required={required}
                  aria-invalid={error ? 'true' : 'false'}
                  {...props}
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  className={twMerge(
                    'font-medium text-gray-700 dark:text-gray-300',
                    (disabled || option.disabled) && 'cursor-not-allowed opacity-50'
                  )}
                  htmlFor={optionId}
                >
                  {option.label}
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p
          className="mt-1 text-sm text-red-600 dark:text-red-400"
          id={`${groupId}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}; 