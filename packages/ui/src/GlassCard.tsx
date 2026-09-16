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
        bg-white/60 backdrop-blur-sm border border-white/40
        rounded-md shadow-sm p-4
        ${onClick ? 'cursor-pointer hover:bg-white/70 transition-colors' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
