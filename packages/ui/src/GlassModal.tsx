import React from 'react'

interface GlassModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function GlassModal({ open, onClose, title, children }: GlassModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-atleti-ink/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-atleti-surface border border-atleti-line rounded-md shadow-soft-lg p-6">
        {title && <h2 className="text-lg font-display font-semibold mb-4 text-atleti-ink">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
