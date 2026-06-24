'use client'
import React, { useState, useRef, useEffect } from 'react'

const DAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toParam(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseParam(s?: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  let dow = first.getDay()
  dow = dow === 0 ? 6 : dow - 1
  const days = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = Array(dow).fill(null)
  for (let d = 1; d <= days; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface DatePickerProps {
  value: string // "YYYY-MM-DD" або ''
  onChange: (v: string) => void
  min?: string
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, min, placeholder = 'Оберіть дату', className = '' }: DatePickerProps) {
  const selected = parseParam(value)
  const minDate = parseParam(min)
  const today = new Date()
  const init = selected ?? today

  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // При відкритті стрибаємо на місяць вибраної дати
  useEffect(() => {
    if (open && selected) {
      setYear(selected.getFullYear())
      setMonth(selected.getMonth())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function isDisabled(d: Date): boolean {
    if (!minDate) return false
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const md = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    return dd < md
  }

  function pick(d: Date) {
    if (isDisabled(d)) return
    onChange(toParam(d))
    setOpen(false)
  }

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const grid = monthGrid(year, month)
  const label = selected
    ? selected.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    : placeholder

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full text-left border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white ${
          selected ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-[60] mt-1 left-0 w-[min(18rem,calc(100vw-2.5rem))] bg-white border border-gray-200 rounded-md shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prev} className="p-1 rounded hover:bg-gray-100 text-gray-600">&lsaquo;</button>
            <span className="text-sm font-semibold text-gray-900">{MONTHS_UA[month]} {year}</span>
            <button type="button" onClick={next} className="p-1 rounded hover:bg-gray-100 text-gray-600">&rsaquo;</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS_UA.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />
              const dis = isDisabled(d)
              const sel = selected ? sameDay(d, selected) : false
              const isToday = sameDay(d, today)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  disabled={dis}
                  className={`h-8 rounded-md text-xs transition-colors ${
                    dis ? 'opacity-30 cursor-not-allowed text-gray-400'
                      : sel ? 'bg-gray-900 text-white'
                      : isToday ? 'bg-gray-100 text-gray-900 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
