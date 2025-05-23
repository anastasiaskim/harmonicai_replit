import React from 'react';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarVariant = 'circle' | 'rounded' | 'square';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  className?: string;
  fallback?: React.ReactNode;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  size = 'md',
  variant = 'circle',
  className,
  fallback,
  onClick,
}) => {
  const sizes = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-14 w-14',
  };

  const variants = {
    circle: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none',
  };

  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setError(false);
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={twMerge(
        'relative inline-block overflow-hidden bg-gray-100 dark:bg-gray-700',
        sizes[size],
        variants[variant],
        onClick && 'cursor-pointer hover:opacity-90',
        className
      )}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {src && !error ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          onError={handleError}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400">
          {fallback || (
            <svg
              className="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}; 