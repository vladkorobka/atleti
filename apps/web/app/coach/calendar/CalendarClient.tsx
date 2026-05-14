'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, GlassModal, Badge } from '@atleti/ui'

interface Client { id: string; name: string; nickname: string }
interface Session {
  _id: string
  clientId: string | { name: string }
  scheduledAt: string
  duration: number
  type: string
  status: string
  cancelReason?: string
}

const SESSION_TYPES = [
  { value: 'regular', label: 'Тренування' },
  { value: 'split', label: 'Спліт' },
  { value: 'online', label: 'Онлайн' },
  { value: 'consultation', label: 'Консультація' },
]

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
  // Monday-first: 0=Mon,...,6=Sun
  let startDow = firstDay.getDay() // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1 // convert to Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function CalendarClient({ clients }: { clients: Client[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [statusModal, setStatusModal] = useState<Session | null>(null)
  const [editModal, setEditModal] = useState<Session | null>(null)
  const [editForm, setEditForm] = useState({ date: '', time: '', duration: '60', type: 'regular' })
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? '',
    date: '',
    time: '',
    duration: '60',
    type: 'regular',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusChanging, setStatusChanging] = useState(false)

  const loadSessions = useCallback(async () => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    const res = await fetch(`/api/coach/sessions?month=${monthStr}`)
    if (!res.ok) {
      setError('Помилка завантаження занять')
      setLoading(false)
      return
    }
    const data = await res.json()
    setSessions(data.sessions ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadSessions() }, [loadSessions])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const grid = getMonthGrid(year, month)
  const daysWithSessions = new Set(
    sessions.map(s => {
      const d = new Date(s.scheduledAt)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const selectedDaySessions = selectedDay
    ? sessions.filter(s => isSameDay(new Date(s.scheduledAt), selectedDay))
    : []

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
    const res = await fetch('/api/coach/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: form.clientId, scheduledAt, duration: Number(form.duration), type: form.type }),
    })
    const data = await res.json()
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); setSaving(false); return }
    setAddOpen(false)
    setSaving(false)
    await loadSessions()
  }

  function openEditModal(s: Session) {
    const d = new Date(s.scheduledAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    setEditForm({ date, time, duration: String(s.duration), type: s.type })
    setEditModal(s)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setSaving(true)
    setError('')
    const scheduledAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString()
    const res = await fetch(`/api/coach/sessions/${editModal._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt, duration: Number(editForm.duration), type: editForm.type }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
    setEditModal(null)
    await loadSessions()
  }

  async function handleStatusChange(sessionId: string, status: string) {
    setStatusChanging(true)
    const res = await fetch(`/api/coach/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setStatusChanging(false)
    if (res.ok) { setStatusModal(null); await loadSessions() }
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  return (
    <div className="space-y-4 pt-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &lsaquo;
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
          &rsaquo;
        </button>
      </div>

      {/* Add session */}
      <button
        onClick={() => setAddOpen(true)}
        disabled={clients.length === 0}
        className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
      >
        {clients.length === 0 ? 'Немає активних клієнтів' : 'Додати заняття'}
      </button>

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

        {/* Day panel — bottom sheet on mobile, right panel on desktop */}
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
                  const clientName = typeof s.clientId === 'object' ? (s.clientId as any).name : '—'
                  const { label, variant } = STATUS_LABELS[s.status] ?? { label: s.status, variant: 'default' as const }
                  return (
                    <GlassCard key={s._id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{clientName}</p>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(s.scheduledAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{s.duration} хв
                      </p>
                      {s.status === 'scheduled' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => openEditModal(s)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => setStatusModal(s)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            Змінити статус
                          </button>
                        </div>
                      )}
                    </GlassCard>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add session modal */}
      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Нове заняття">
        <form onSubmit={handleAddSession} className="space-y-3">
          <select
            value={form.clientId}
            onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} (@{c.nickname})</option>)}
          </select>
          <input
            type="date" required
            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="time" required
            value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min="15" max="480"
              value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="Тривалість (хв)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <select
              value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Додати заняття'}
          </button>
        </form>
      </GlassModal>

      {/* Status change modal */}
      {statusModal && (
        <GlassModal open={true} onClose={() => setStatusModal(null)} title="Статус заняття">
          <div className="space-y-2">
            <button
              onClick={() => handleStatusChange(statusModal._id, 'completed')}
              disabled={statusChanging}
              className={`w-full border border-green-300 text-green-700 rounded-md py-2.5 text-sm font-medium hover:bg-green-50 transition-colors${statusChanging ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              Позначити як проведене
            </button>
            <button
              onClick={() => handleStatusChange(statusModal._id, 'cancelled')}
              disabled={statusChanging}
              className={`w-full border border-red-300 text-red-700 rounded-md py-2.5 text-sm font-medium hover:bg-red-50 transition-colors${statusChanging ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              Скасувати заняття
            </button>
          </div>
        </GlassModal>
      )}

      {/* Edit session modal */}
      {editModal && (
        <GlassModal open={true} onClose={() => { setEditModal(null); setError('') }} title="Редагувати заняття">
          <form onSubmit={handleEdit} className="space-y-3">
            <input
              type="date" required
              value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="time" required
              value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" min="15" max="480" required
                value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="Тривалість (хв)"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <select
                value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              >
                {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </form>
        </GlassModal>
      )}
    </div>
  )
}
