import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

interface NavigationItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavigationProps {
  items: NavigationItem[];
  className?: string;
  logo?: React.ReactNode;
  userMenu?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({
  items,
  className,
  logo,
  userMenu,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav
      className={twMerge(
        'bg-white dark:bg-gray-800 shadow-sm',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {logo && (
              <div className="flex-shrink-0 flex items-center">
                {logo}
              </div>
            )}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 dark:text-white hover:text-gray-500 dark:hover:text-gray-300"
                >
                  {item.icon && (
                    <span className="mr-2">{item.icon}</span>
                  )}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {userMenu}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <span className="sr-only">
                {isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              </span>
              {isMobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={twMerge(
          'sm:hidden',
          isMobileMenuOpen ? 'block' : 'hidden'
        )}
        id="mobile-menu"
      >
        <div className="pt-2 pb-3 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block pl-3 pr-4 py-2 text-base font-medium text-gray-900 dark:text-white hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {item.icon && (
                <span className="mr-2">{item.icon}</span>
              )}
              {item.label}
            </Link>
          ))}
        </div>
        {userMenu && (
          <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700">
            {userMenu}
          </div>
        )}
      </div>
    </nav>
  );
}; 