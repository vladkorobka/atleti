'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, Badge } from '@atleti/ui'
import { kyivParts, formatKyiv, kyivInputToUtc } from '@/lib/tz'

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

const SESSION_TYPE_KEYS = ['regular', 'split', 'online', 'consultation'] as const
type SessionType = (typeof SESSION_TYPE_KEYS)[number]

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
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function toDateParam(day: Date): string {
  const y = day.getFullYear()
  const m = String(day.getMonth() + 1).padStart(2, '0')
  const d = String(day.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function ClientCalendar() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<SessionType>('regular')
  const [booking, setBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/client/sessions')
      if (!res.ok) { setError('Помилка завантаження занять'); return }
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch {
      setError('Помилка завантаження занять')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/client/balance')
      if (!res.ok) return
      const data = await res.json()
      setSessionsRemaining(data.balance?.sessionsRemaining ?? 0)
    } catch {
      // баланс необов'язковий для відображення
    }
  }, [])

  useEffect(() => {
    loadSessions()
    loadBalance()
  }, [loadSessions, loadBalance])

  const loadSlots = useCallback(async (day: Date) => {
    setSlotsLoading(true)
    setSlotsError('')
    setSlots([])
    setSelectedSlot(null)
    setBookingError('')
    try {
      const dateParam = toDateParam(day)
      const res = await fetch(`/api/coach/available-slots?date=${dateParam}`)
      if (!res.ok) {
        setSlotsError('Помилка завантаження слотів')
        return
      }
      const data = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      setSlotsError('Помилка завантаження слотів')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
    setSlots([])
    setSelectedSlot(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
    setSlots([])
    setSelectedSlot(null)
  }

  function handleDayClick(day: Date) {
    if (day < today) return
    const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
    if (isSelected) {
      setSelectedDay(null)
      setSlots([])
      setSelectedSlot(null)
    } else {
      setSelectedDay(day)
      loadSlots(day)
    }
  }

  async function handleBook() {
    if (!selectedDay || !selectedSlot) return
    setBooking(true)
    setBookingError('')
    try {
      const dateParam = toDateParam(selectedDay)
      // київський настінний час слоту → справжній UTC
      const scheduledAt = kyivInputToUtc(dateParam, selectedSlot).toISOString()
      const res = await fetch('/api/client/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt, type: selectedType }),
      })
      if (res.ok) {
        setSelectedSlot(null)
        await Promise.all([loadSessions(), loadSlots(selectedDay), loadBalance()])
      } else {
        const data = await res.json()
        if (res.status === 402) setBookingError('Недостатньо занять на балансі')
        else if (res.status === 409) setBookingError('Слот вже зайнятий')
        else setBookingError(data.error ?? 'Помилка бронювання')
      }
    } catch {
      setBookingError('Помилка бронювання')
    } finally {
      setBooking(false)
    }
  }

  // фільтр/матчинг занять — за київською календарною датою
  const monthSessions = sessions.filter(s => {
    const p = kyivParts(new Date(s.scheduledAt))
    return p.year === year && p.month - 1 === month
  })

  const grid = getMonthGrid(year, month)

  const kyivDayKey = (date: Date) => { const p = kyivParts(date); return `${p.year}-${p.month - 1}-${p.day}` }
  const isSameKyivDay = (date: Date, gridDay: Date) => {
    const p = kyivParts(date)
    return p.year === gridDay.getFullYear() && p.month - 1 === gridDay.getMonth() && p.day === gridDay.getDate()
  }

  const daysWithSessions = new Set(monthSessions.map(s => kyivDayKey(new Date(s.scheduledAt))))

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const selectedDaySessions = selectedDay
    ? monthSessions.filter(s => isSameKyivDay(new Date(s.scheduledAt), selectedDay))
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
      if (selectedDay) await loadSlots(selectedDay)
    } else if (res.status === 403) {
      alert('Термін скасування минув')
    } else {
      alert('Помилка при скасуванні заняття')
    }
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  const hasBalance = sessionsRemaining !== null && sessionsRemaining > 0

  return (
    <div className="space-y-4 pt-4">
      {error && <p className="text-sm text-red-500 text-center py-2">{error}</p>}

      {sessionsRemaining !== null && (
        <div className="flex items-center justify-end">
          <span className="text-xs text-gray-500">
            Залишок занять:{' '}
            <span className={`font-semibold ${sessionsRemaining === 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {sessionsRemaining}
            </span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &lsaquo;
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &rsaquo;
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <GlassCard className="p-2">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_UA.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <div key={i} />
                const isToday = isSameDay(day, now)
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                const hasSessions = daysWithSessions.has(dayKey(day))
                const isPast = day < today
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    disabled={isPast}
                    className={`
                      relative flex flex-col items-center py-2 rounded-md text-sm transition-colors
                      ${isPast ? 'opacity-30 cursor-not-allowed text-gray-400' :
                        isSelected ? 'bg-gray-900 text-white' :
                        isToday ? 'bg-gray-100 text-gray-900 font-semibold' :
                        'text-gray-700 hover:bg-gray-50'}
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

        {selectedDay && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedDay.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
              </h2>
              <button onClick={() => { setSelectedDay(null); setSlots([]); setSelectedSlot(null) }} className="text-xs text-gray-400 hover:text-gray-600">
                Закрити
              </button>
            </div>

            {/* Existing sessions */}
            {selectedDaySessions.length > 0 && (
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
                        {formatKyiv(scheduledDate, { hour: '2-digit', minute: '2-digit' })}
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

            {/* Available slots */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Вільні слоти</p>
              {slotsLoading ? (
                <GlassCard>
                  <p className="text-sm text-gray-400 text-center py-3">Завантаження...</p>
                </GlassCard>
              ) : slotsError ? (
                <GlassCard>
                  <p className="text-sm text-red-400 text-center py-3">{slotsError}</p>
                </GlassCard>
              ) : slots.length === 0 ? (
                <GlassCard>
                  <p className="text-sm text-gray-400 text-center py-3">Вільних слотів немає</p>
                </GlassCard>
              ) : (
                <div className="space-y-2">
                  {!hasBalance && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      Поповніть баланс для бронювання
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-1.5">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)}
                        disabled={!hasBalance}
                        className={`
                          px-2 py-2 text-sm rounded-md border transition-colors
                          ${!hasBalance ? 'opacity-40 cursor-not-allowed bg-white/60 backdrop-blur border-gray-200 text-gray-500' :
                            selectedSlot === slot ? 'bg-gray-900 text-white border-gray-900' :
                            'bg-white/60 backdrop-blur border-gray-200 text-gray-700 hover:bg-gray-50'}
                        `}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>

                  {selectedSlot && hasBalance && (
                    <GlassCard className="space-y-3">
                      <p className="text-xs font-medium text-gray-700">
                        Тип заняття — {selectedSlot}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SESSION_TYPE_KEYS.map(t => (
                          <button
                            key={t}
                            onClick={() => setSelectedType(t)}
                            className={`
                              px-2 py-1.5 text-xs rounded-md border transition-colors
                              ${selectedType === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/60 backdrop-blur border-gray-200 text-gray-700 hover:bg-gray-50'}
                            `}
                          >
                            {SESSION_TYPES[t]}
                          </button>
                        ))}
                      </div>
                      {bookingError && (
                        <p className="text-xs text-red-500">{bookingError}</p>
                      )}
                      <button
                        onClick={handleBook}
                        disabled={booking}
                        className="w-full py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {booking ? 'Бронювання...' : 'Забронювати'}
                      </button>
                    </GlassCard>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
