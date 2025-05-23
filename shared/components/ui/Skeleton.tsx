import React from 'react';
import { twMerge } from 'tailwind-merge';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';
type SkeletonSize = 'sm' | 'md' | 'lg';

interface SkeletonProps {
  variant?: SkeletonVariant;
  size?: SkeletonSize;
  className?: string;
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  size = 'md',
  className,
  width,
  height,
  animation = 'pulse',
}) => {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const sizes = {
    sm: 'h-4',
    md: 'h-6',
    lg: 'h-8',
  };

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: '',
  };

  const getHeight = () => {
    if (height) return height;
    if (variant === 'circular') return width || sizes[size];
    return sizes[size];
  };

  const getWidth = () => {
    if (width) return width;
    if (variant === 'circular') return height || sizes[size];
    return '100%';
  };

  return (
    <div
      className={twMerge(
        'bg-gray-200 dark:bg-gray-700',
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: getWidth(),
        height: getHeight(),
      }}
      role="status"
      aria-label="Loading"
    />
  );
};

interface SkeletonTextProps {
  lines?: number;
  size?: SkeletonSize;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  size = 'md',
  className,
  animation = 'pulse',
}) => {
  return (
    <div className={twMerge('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          size={size}
          animation={animation}
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};

interface SkeletonAvatarProps {
  size?: SkeletonSize;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  className,
  animation = 'pulse',
}) => {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <Skeleton
      variant="circular"
      size={size}
      className={twMerge(sizes[size], className)}
      animation={animation}
    />
  );
}; 