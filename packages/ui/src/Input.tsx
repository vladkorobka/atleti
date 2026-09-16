'use client'
import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Підпис над полем (опційно). */
  label?: string
  /** Текст помилки під полем. */
  error?: string
  /** Іконка зліва всередині поля. */
  leftIcon?: React.ReactNode
}

// Уніфіковане поле вводу у стилі Apple/Liquid Glass.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, leftIcon, className = '', id, ...rest },
  ref
) {
  const inputEl = (
    <input
      ref={ref}
      id={id}
      className={`w-full rounded-md border bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-sm
        placeholder:text-gray-400 transition-colors
        focus:outline-none focus:ring-2 focus:ring-gray-400/60 focus:border-gray-300
        disabled:opacity-60
        ${error ? 'border-red-400' : 'border-gray-300'}
        ${leftIcon ? 'pl-9' : ''}
        ${className}`}
      {...rest}
    />
  )

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {leftIcon ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-600">
            {leftIcon}
          </span>
          {inputEl}
        </div>
      ) : (
        inputEl
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})
