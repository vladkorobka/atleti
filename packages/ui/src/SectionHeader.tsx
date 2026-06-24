import React from 'react'

interface SectionHeaderProps {
  title: React.ReactNode
  /** Підзаголовок під титулом. */
  subtitle?: React.ReactNode
  /** Дії праворуч (кнопки тощо). */
  action?: React.ReactNode
  /** Іконка зліва від титулу. */
  icon?: React.ReactNode
  className?: string
}

// Уніфікований заголовок секції: титул + опційний підзаголовок і дія праворуч.
export function SectionHeader({ title, subtitle, action, icon, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-gray-500">{icon}</span>}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
