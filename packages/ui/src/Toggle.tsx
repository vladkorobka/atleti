'use client'
import React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

// Кастомний перемикач (тумблер) замість стандартного checkbox.
export function Toggle({ checked, onChange, label, disabled = false, id, className = '' }: ToggleProps) {
  const button = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:opacity-50 ${
        checked ? 'bg-gray-900' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )

  if (label === undefined) return <span className={className}>{button}</span>

  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50' : ''} ${className}`}>
      {button}
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  )
}
