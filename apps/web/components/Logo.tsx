'use client'
import { useState } from 'react'

// Логотип Атлеті. Якщо файл зображення відсутній — показуємо текстовий фолбек.
export function Logo({ className = 'h-7' }: { className?: string }) {
  const [err, setErr] = useState(false)
  if (err) return <span className="font-semibold text-gray-900">Атлеті</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo_man_non_background.webp"
      alt="Атлеті"
      onError={() => setErr(true)}
      className={`${className} w-auto object-contain`}
    />
  )
}
