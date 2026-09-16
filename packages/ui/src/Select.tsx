'use client'
import React, { useRef, useState } from 'react'
import { Popover } from './Popover'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
}

// Кастомний дропдаун: попап у порталі з viewport-aware позиціонуванням,
// тож не випадає за екран навіть у модалці біля низу.
export function Select({ value, onChange, options, placeholder = 'Оберіть...', className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const selected = options.find(o => o.value === value)

  return (
    <div className={className}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          selected ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btnRef.current} matchWidth>
        <div
          role="listbox"
          className="max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl py-1"
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                o.value === value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
