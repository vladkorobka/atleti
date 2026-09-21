'use client'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface GlassModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

// Спільний лічильник відкритих модалок. Модалки вкладаються (ConfirmDialog поверх
// форми), і якщо кожна запам'ятовує стиль body «до себе», внутрішня збереже вже
// заблокований overflow і при закритті поверне його — сторінка лишиться без скролу.
// Тому знімок робить лише найзовнішня, і лише вона ж його відновлює.
let scrollLockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

export function GlassModal({ open, onClose, title, children }: GlassModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Блокуємо скрол фону, поки модалка відкрита — сторінка позаду не рухається.
  // Компенсуємо ширину скролбара paddingRight, щоб не було «стрибка» лейауту.
  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    if (scrollLockCount === 0) {
      savedOverflow = body.style.overflow
      savedPaddingRight = body.style.paddingRight
      const scrollbarW = window.innerWidth - documentElement.clientWidth
      body.style.overflow = 'hidden'
      if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`
    }
    scrollLockCount++
    return () => {
      scrollLockCount--
      if (scrollLockCount === 0) {
        body.style.overflow = savedOverflow
        body.style.paddingRight = savedPaddingRight
      }
    }
  }, [open])

  if (!open || !mounted) return null

  // Портал у body: інакше всередині батька з backdrop-blur/transform
  // `fixed inset-0` обрізається межами цього батька, а не покриває весь екран.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Висоту обмежуємо екраном: інакше на мобільному верх високої модалки йде за viewport,
          а фон заблоковано — дістатися до нього неможливо. dvh враховує панелі iOS Safari. */}
      <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white border border-gray-200 rounded-md shadow-xl p-6">
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  )
}
