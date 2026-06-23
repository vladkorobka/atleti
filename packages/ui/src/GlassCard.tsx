import React from 'react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function GlassCard({ children, className = '', onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-atleti-surface border border-atleti-line
        rounded-md shadow-soft p-4
        ${onClick ? 'cursor-pointer hover:shadow-soft-lg transition-shadow' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
