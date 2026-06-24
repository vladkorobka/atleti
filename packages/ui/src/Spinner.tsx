import React from 'react'

interface SpinnerProps {
  /** Розмір у px (зовнішній діаметр). За замовчуванням 28. */
  size?: number
  className?: string
}

// Круговий індикатор завантаження.
export function Spinner({ size = 28, className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Завантаження"
      className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

// Лоадер по центру доступного простору.
export function CenteredSpinner({ size = 28, className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Spinner size={size} />
    </div>
  )
}
