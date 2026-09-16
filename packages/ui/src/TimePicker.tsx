'use client'
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Popover } from './Popover'

const ITEM_H = 40
const VISIBLE = 5
const PAD = ((VISIBLE - 1) / 2) * ITEM_H

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

interface WheelColumnProps {
  values: number[]
  selected: number
  onSelect: (v: number) => void
  ariaLabel: string
}

function WheelColumn({ values, selected, onSelect, ariaLabel }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const index = Math.max(0, values.indexOf(selected))

  // Тримаємо позицію скролу синхронною зі значенням (зокрема при зовнішній зміні)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [index])

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const i = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.min(Math.max(i, 0), values.length - 1)
      const v = values[clamped]
      el.scrollTop = clamped * ITEM_H
      if (v !== selected) onSelect(v)
    }, 110)
  }, [values, selected, onSelect])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (index < values.length - 1) onSelect(values[index + 1])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (index > 0) onSelect(values[index - 1])
    }
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onKeyDown={handleKey}
      tabIndex={0}
      role="listbox"
      aria-label={ariaLabel}
      className="relative w-14 overflow-y-auto snap-y snap-mandatory focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-md [&::-webkit-scrollbar]:hidden"
      style={{ height: ITEM_H * VISIBLE, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      <div style={{ height: PAD }} aria-hidden />
      {values.map(v => (
        <div
          key={v}
          role="option"
          aria-selected={v === selected}
          onClick={() => onSelect(v)}
          className={`flex items-center justify-center snap-center cursor-pointer transition-colors ${
            v === selected ? 'text-gray-900 font-semibold text-lg' : 'text-gray-400'
          }`}
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
        >
          {pad2(v)}
        </div>
      ))}
      <div style={{ height: PAD }} aria-hidden />
    </div>
  )
}

interface TimePickerProps {
  value: string // "HH:MM"
  onChange: (v: string) => void
  step?: number
  /** Обмеження діапазону годин (наприклад, робочий графік тренера), формат "HH:MM". */
  minTime?: string
  maxTime?: string
  className?: string
}

export function TimePicker({ value, onChange, step = 5, minTime, maxTime, className = '' }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Показуємо лише години в межах діапазону (минути ділимо за step).
  const minH = minTime ? Number(minTime.split(':')[0]) : 0
  const maxH = maxTime ? Number(maxTime.split(':')[0]) : 23
  const hours = Array.from({ length: 24 }, (_, i) => i).filter(h => h >= minH && h <= maxH)
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step)

  const [hStr, mStr] = (value || '00:00').split(':')
  let h = Number(hStr)
  let m = Number(mStr)
  if (Number.isNaN(h)) h = 0
  if (Number.isNaN(m)) m = 0

  // Час не по сітці кроку (напр. 10:37) снапимо до найближчого і фіксуємо в стані
  const snappedM = minutes.reduce((prev, cur) => (Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev), minutes[0])
  useEffect(() => {
    if (snappedM !== m) onChange(`${pad2(h)}:${pad2(snappedM)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const display = value ? `${pad2(h)}:${pad2(snappedM)}` : '--:--'

  return (
    <div className={className}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white ${
          value ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        {display}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btnRef.current} align="center">
        <div className="bg-white border border-gray-200 rounded-md shadow-xl p-2">
          <div className="relative flex items-stretch justify-center gap-1">
            <div
              className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 rounded-md bg-gray-900/5 border-y border-gray-200"
              style={{ height: ITEM_H }}
              aria-hidden
            />
            <WheelColumn values={hours} selected={h} onSelect={nh => onChange(`${pad2(nh)}:${pad2(snappedM)}`)} ariaLabel="Години" />
            <span className="self-center text-gray-400 font-semibold">:</span>
            <WheelColumn values={minutes} selected={snappedM} onSelect={nm => onChange(`${pad2(h)}:${pad2(nm)}`)} ariaLabel="Хвилини" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full bg-gray-900 text-white rounded-md py-1.5 text-xs font-medium hover:bg-gray-700"
          >
            Готово
          </button>
        </div>
      </Popover>
    </div>
  )
}
