import React from 'react';
import { twMerge } from 'tailwind-merge';

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  className?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const Form: React.FC<FormProps> = ({ children, className, onSubmit, ...props }) => (
  <form
    className={twMerge('space-y-6', className)}
    onSubmit={onSubmit}
    {...props}
  >
    {children}
  </form>
);

interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  className,
  label,
  htmlFor,
  error,
  required,
}) => (
  <div className={twMerge('space-y-2', className)}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {error && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert" id={`${htmlFor}-error`}>
        {error}
      </p>
    )}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, id, ...props }, ref) => (
    <input
      ref={ref}
      id={id}
      className={twMerge(
        'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        className
      )}
      aria-invalid={error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  )
);
Input.displayName = 'Input';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
  error?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, id, ...props }, ref) => (
    <textarea
      ref={ref}
      id={id}
      className={twMerge(
        'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        className
      )}
      aria-invalid={error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  )
);
TextArea.displayName = 'TextArea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  error?: boolean;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, options, id, ...props }, ref) => (
    <select
      ref={ref}
      id={id}
      className={twMerge(
        'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
        className
      )}
      aria-invalid={error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
);
Select.displayName = 'Select'; 