import React from 'react'

// Пульсуючий плейсхолдер для станів завантаження.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/70 ${className}`} aria-hidden />
}
