'use client'
import React from 'react'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Показати спінер і заблокувати кнопку. */
  loading?: boolean
  /** Розтягнути на всю ширину контейнера. */
  fullWidth?: boolean
  /** Іконка зліва від тексту (inline-SVG у стилі Apple, без емодзі). */
  leftIcon?: React.ReactNode
  /** Іконка справа від тексту. */
  rightIcon?: React.ReactNode
}

// Базовий вигляд — як панель дій календаря: rounded-md, subtle shadow, чисті переходи.
const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium ' +
  'transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  // Домінантна CTA — як «+ Заняття».
  primary: 'bg-gray-900 text-white shadow-sm hover:bg-gray-700 active:bg-gray-800',
  // Secondary — скляна поверхня з тонкою рамкою.
  secondary:
    'bg-white/60 backdrop-blur-sm border border-white/40 text-gray-700 shadow-sm hover:bg-white/80 active:bg-white',
  // Деструктив.
  danger: 'bg-red-500 text-white shadow-sm hover:bg-red-600 active:bg-red-700',
  // Прозора дія без фону.
  ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
}

const spinnerToneByVariant: Record<ButtonVariant, string> = {
  primary: 'border-white/40 border-t-white',
  danger: 'border-white/40 border-t-white',
  secondary: 'border-gray-300 border-t-gray-700',
  ghost: 'border-gray-300 border-t-gray-700',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={16} className={spinnerToneByVariant[variant]} />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children != null && children !== '' && <span className="truncate">{children}</span>}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
}
