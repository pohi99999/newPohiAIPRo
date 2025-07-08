
import React from 'react';
import { NavLink } from 'react-router-dom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  to?: string;
  as?: React.ElementType;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className: classNameFromProps = '',
  disabled: disabledFromProps,
  to,
  as,
  ...restProps
}) => {
  const baseStyles = 'font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 inline-flex items-center justify-center transition-colors duration-150 ease-in-out hover-glow disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-cyan-600 text-white hover:bg-cyan-700 focus:ring-cyan-500',
    secondary: 'bg-slate-600 text-slate-100 hover:bg-slate-500 focus:ring-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-cyan-400 hover:bg-cyan-500/10 focus:ring-cyan-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const finalClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${classNameFromProps}`;
  
  const calculatedDisabledState = isLoading || disabledFromProps;

  const buttonContent = (
    <>
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
    </>
  );
  
  // If `to` is provided, we assume it's a NavLink. `as` prop is ignored in favor of `to`.
  if (to) {
    // We handle button-specific props separately to avoid passing them to NavLink.
    // 'disabled' is handled by `calculatedDisabledState`.
    // 'type' is a button-specific attribute. We use 'any' on linkProps to bypass type-checking for other event handlers.
    const { type, ...linkProps } = restProps;
    if (calculatedDisabledState) {
        // Render a non-interactive span that looks like a disabled button
        return (
            <span className={`${finalClassName} opacity-50 cursor-not-allowed`} aria-disabled="true">
                {buttonContent}
            </span>
        );
    }
    return (
      <NavLink 
        to={to} 
        className={finalClassName} 
        {...(linkProps as any)}
      >
        {buttonContent}
      </NavLink>
    );
  }

  // Fallback to `as` prop or default 'button'
  const Component = as || 'button';
  
  return (
    <Component
      className={finalClassName}
      disabled={calculatedDisabledState} 
      {...restProps}
    >
      {buttonContent}
    </Component>
  );
};

export default Button;
