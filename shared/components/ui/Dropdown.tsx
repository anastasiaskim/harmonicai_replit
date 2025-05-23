import React, { useState, useRef, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  value,
  onChange,
  className,
  placeholder = 'Select an option',
  disabled = false,
  error,
  label,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          const currentIndex = items.findIndex((item) => item.value === value);
          const nextIndex = (currentIndex + 1) % items.length;
          onChange(items[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          const currentIndex = items.findIndex((item) => item.value === value);
          const prevIndex = (currentIndex - 1 + items.length) % items.length;
          onChange(items[prevIndex].value);
        }
        break;
    }
  };

  return (
    <div className={twMerge('relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div
        className={twMerge(
          'relative',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <button
          type="button"
          className={twMerge(
            'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            disabled && 'cursor-not-allowed'
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? 'dropdown-label' : undefined}
          aria-describedby={error ? 'dropdown-error' : undefined}
        >
          <span className="block truncate">
            {selectedItem ? (
              <span className="flex items-center">
                {selectedItem.icon && (
                  <span className="mr-2">{selectedItem.icon}</span>
                )}
                {selectedItem.label}
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                {placeholder}
              </span>
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className="h-5 w-5 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>
        {isOpen && (
          <ul
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            role="listbox"
            tabIndex={-1}
          >
            {items.map((item) => (
              <li
                key={item.value}
                className={twMerge(
                  'relative cursor-pointer select-none py-2 pl-3 pr-9',
                  item.disabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600',
                  value === item.value && 'bg-blue-50 dark:bg-blue-900'
                )}
                role="option"
                aria-selected={value === item.value}
                onClick={() => !item.disabled && onChange(item.value)}
              >
                <span className="flex items-center">
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </span>
                {value === item.value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p
          className="mt-1 text-sm text-red-600 dark:text-red-400"
          id="dropdown-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}; 