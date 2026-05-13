'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, Badge } from '@atleti/ui'

interface Session {
  _id: string
  coachId: string | { name: string; nickname: string }
  scheduledAt: string
  duration: number
  type: string
  status: string
  cancelReason?: string
}

const SESSION_TYPES: Record<string, string> = {
  regular: 'Тренування',
  split: 'Спліт',
  online: 'Онлайн',
  consultation: 'Консультація',
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  scheduled: { label: 'Заплановано', variant: 'warning' },
  completed: { label: 'Проведено', variant: 'success' },
  cancelled: { label: 'Скасовано', variant: 'danger' },
}

const DAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay() // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1 // convert to Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function ClientCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/client/sessions')
    if (res.ok) {
      const data = await res.json()
      setSessions(data.sessions ?? [])
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Filter sessions to only those in the displayed month
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.scheduledAt)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const grid = getMonthGrid(year, month)

  const daysWithSessions = new Set(
    monthSessions.map(s => {
      const d = new Date(s.scheduledAt)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const selectedDaySessions = selectedDay
    ? monthSessions.filter(s => isSameDay(new Date(s.scheduledAt), selectedDay))
    : []

  async function handleCancel(sessionId: string) {
    setCancelling(sessionId)
    const res = await fetch(`/api/client/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setCancelling(null)
    if (res.ok) {
      await loadSessions()
    } else if (res.status === 403) {
      alert('Термін скасування минув')
    } else {
      alert('Помилка при скасуванні заняття')
    }
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &lsaquo;
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &rsaquo;
        </button>
      </div>

      {/* Layout: calendar + optional day panel */}
      <div className="lg:flex lg:gap-4">
        {/* Calendar grid */}
        <div className="lg:flex-1">
          <GlassCard className="p-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS_UA.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <div key={i} />
                const isToday = isSameDay(day, now)
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                const hasSessions = daysWithSessions.has(dayKey(day))
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative flex flex-col items-center py-2 rounded-md text-sm transition-colors
                      ${isSelected ? 'bg-gray-900 text-white' : isToday ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    {day.getDate()}
                    {hasSessions && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </div>

        {/* Day panel — below calendar on mobile, right side on desktop */}
        {selectedDay && (
          <div className="lg:w-72 mt-4 lg:mt-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedDay.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
              </h2>
              <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Закрити
              </button>
            </div>
            {selectedDaySessions.length === 0 ? (
              <GlassCard>
                <p className="text-sm text-gray-400 text-center py-4">Занять немає</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {selectedDaySessions.map(s => {
                  const { label, variant } = STATUS_LABELS[s.status] ?? { label: s.status, variant: 'default' as const }
                  const typeLabel = SESSION_TYPES[s.type] ?? s.type
                  const scheduledDate = new Date(s.scheduledAt)
                  const isFuture = scheduledDate > now
                  return (
                    <GlassCard key={s._id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{typeLabel}</p>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {scheduledDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{s.duration} хв
                      </p>
                      {s.status === 'scheduled' && isFuture && (
                        <button
                          onClick={() => handleCancel(s._id)}
                          disabled={cancelling === s._id}
                          className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
                        >
                          {cancelling === s._id ? 'Скасування...' : 'Скасувати'}
                        </button>
                      )}
                    </GlassCard>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
