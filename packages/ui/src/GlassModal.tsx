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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-lg border border-white/50 rounded-md shadow-lg p-6">
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
