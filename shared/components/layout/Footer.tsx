import React from 'react';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface FooterProps {
  sections: FooterSection[];
  socialLinks: SocialLink[];
  className?: string;
  copyright?: string;
}

export const Footer: React.FC<FooterProps> = ({
  sections,
  socialLinks,
  className,
  copyright = `© ${new Date().getFullYear()} Harmonic AI. All rights reserved.`,
}) => {
  return (
    <footer
      className={twMerge(
        'bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <div className="flex space-x-6">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-base">
              {copyright}
            </p>
          </div>
          <div className="mt-8 md:mt-12 grid grid-cols-2 gap-6 md:gap-8 xl:mt-0 xl:col-span-2">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              {sections.map((section) => (
                <div key={section.title} className="mt-6 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wider uppercase">
                    {section.title}
                  </h3>
                  <ul className="mt-3 md:mt-4 space-y-3 md:space-y-4">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-base text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}; 