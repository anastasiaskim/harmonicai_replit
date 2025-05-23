import React from 'react';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className,
  separator = (
    <svg
      className="h-5 w-5 flex-shrink-0 text-gray-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
    </svg>
  ),
}) => {
  return (
    <nav
      className={twMerge('flex', className)}
      aria-label="Breadcrumb"
    >
      <ol
        role="list"
        className="flex items-center space-x-4"
      >
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center">
            {index > 0 && (
              <span className="mx-4" aria-hidden="true">
                {separator}
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className={twMerge(
                  'text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  index === items.length - 1 && 'text-gray-900 dark:text-white'
                )}
                aria-current={index === items.length - 1 ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={twMerge(
                  'text-sm font-medium text-gray-500 dark:text-gray-400',
                  index === items.length - 1 && 'text-gray-900 dark:text-white'
                )}
                aria-current={index === items.length - 1 ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}; 