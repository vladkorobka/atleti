'use client'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** Елемент-тригер, відносно якого позиціонується попап. */
  anchor: HTMLElement | null
  children: React.ReactNode
  /** Горизонтальне вирівнювання відносно тригера. */
  align?: 'start' | 'center'
  /** Розтягнути попап на ширину тригера (для дропдаунів). */
  matchWidth?: boolean
  className?: string
}

const MARGIN = 8 // мінімальний відступ від країв в'юпорта

// Попап у порталі (body) з position: fixed та обчисленням позиції від тригера.
// Сам визначає, відкритись вгору чи вниз, і не дає вилізти за екран —
// тому коректно працює навіть усередині модалки, прикріпленої до низу.
export function Popover({ open, onClose, anchor, children, align = 'start', matchWidth = false, className = '' }: PopoverProps) {
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const compute = useCallback(() => {
    const el = popRef.current
    if (!anchor || !el) return
    const a = anchor.getBoundingClientRect()
    const w = matchWidth ? a.width : el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    const spaceBelow = vh - a.bottom
    const spaceAbove = a.top
    const placeBelow = spaceBelow >= h + MARGIN || spaceBelow >= spaceAbove
    let top = placeBelow ? a.bottom + 4 : a.top - h - 4
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN))

    let left = align === 'center' ? a.left + a.width / 2 - w / 2 : a.left
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN))

    setPos({ top, left, width: matchWidth ? w : undefined })
  }, [anchor, align, matchWidth])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, compute])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (popRef.current?.contains(t) || anchor?.contains(t)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchor])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={popRef}
      className={`fixed z-[70] ${className}`}
      // Поки позиція не обчислена — рендеримо приховано за межами, щоб виміряти розмір.
      style={
        pos
          ? { top: pos.top, left: pos.left, width: pos.width }
          : { top: -9999, left: -9999, visibility: 'hidden' }
      }
    >
      {children}
    </div>,
    document.body
  )
}
