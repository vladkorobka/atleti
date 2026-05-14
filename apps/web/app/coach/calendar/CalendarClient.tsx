'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, GlassModal, Badge } from '@atleti/ui'
import { generateSlots, isDayBlocked, getSlotBlock } from '@/lib/slot-utils'
import type { ICoachBlock, DowKey, IWorkingHoursDay } from '@atleti/types'

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

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const ALL_SCHEDULE_DAYS: { key: DowKey; label: string }[] = [
  { key: 'mon', label: 'Понеділок' },
  { key: 'tue', label: 'Вівторок' },
  { key: 'wed', label: 'Середа' },
  { key: 'thu', label: 'Четвер' },
  { key: 'fri', label: 'П\'ятниця' },
  { key: 'sat', label: 'Субота' },
  { key: 'sun', label: 'Неділя' },
]

type ScheduleDay = { enabled: boolean; start: string; end: string; slotDuration: string }
type WorkingHoursMap = Partial<Record<DowKey, IWorkingHoursDay>>

function makeDefaultScheduleForm(wh: WorkingHoursMap): Record<DowKey, ScheduleDay> {
  const result = {} as Record<DowKey, ScheduleDay>
  for (const { key } of ALL_SCHEDULE_DAYS) {
    const existing = wh[key]
    result[key] = existing
      ? { enabled: true, start: existing.start, end: existing.end, slotDuration: String(existing.slotDuration) }
      : { enabled: false, start: '09:00', end: '18:00', slotDuration: '60' }
  }
  return result
}

function workingHoursSummary(wh: WorkingHoursMap): string {
  const parts: string[] = []
  for (const { key, label } of ALL_SCHEDULE_DAYS) {
    const h = wh[key]
    if (h) parts.push(`${label.slice(0, 2)} ${h.start}–${h.end} · ${h.slotDuration} хв`)
  }
  return parts.length ? parts.join(' | ') : 'Графік не налаштовано'
}

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

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarClient({ clients }: { clients: Client[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<Session[]>([])
  const [blocks, setBlocks] = useState<ICoachBlock[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>({})
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // existing modals
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
  const [statusChanging, setStatusChanging] = useState(false)

  // new modals
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<Record<DowKey, ScheduleDay>>(() =>
    makeDefaultScheduleForm({})
  )
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockForm, setBlockForm] = useState({
    type: 'time' as 'time' | 'day' | 'vacation',
    date: '',
    startTime: '',
    endTime: '',
    dateFrom: '',
    dateTo: '',
    label: '',
    recurringEnabled: false,
    recurringType: 'daily' as 'daily' | 'weekly',
    recurringDayOfWeek: 'mon' as DowKey,
    recurringUntil: '',
  })

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/settings')
      if (res.ok) {
        const data = await res.json()
        setWorkingHours(data.workingHours ?? {})
      }
    } catch {
      setError('Помилка завантаження налаштувань')
    }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
      const [sessRes, blkRes] = await Promise.all([
        fetch(`/api/coach/sessions?month=${monthStr}`),
        fetch(`/api/coach/blocks?month=${monthStr}`),
      ])
      if (!sessRes.ok) { setError('Помилка завантаження занять'); return }
      const sessData = await sessRes.json()
      setSessions(sessData.sessions ?? [])
      if (blkRes.ok) {
        const blkData = await blkRes.json()
        setBlocks(blkData.blocks ?? [])
      }
    } catch {
      setError('Помилка завантаження даних')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { loadSessions() }, [loadSessions])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function openScheduleModal() {
    setError('')
    setScheduleForm(makeDefaultScheduleForm(workingHours))
    setScheduleOpen(true)
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const newWorkingHours: WorkingHoursMap = {}
    for (const { key } of ALL_SCHEDULE_DAYS) {
      const d = scheduleForm[key]
      if (d.enabled) {
        newWorkingHours[key] = { start: d.start, end: d.end, slotDuration: Number(d.slotDuration) }
      }
    }
    try {
      const res = await fetch('/api/coach/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHours: newWorkingHours }),
      })
      if (!res.ok) { setError('Помилка збереження'); return }
      setWorkingHours(newWorkingHours)
      setScheduleOpen(false)
    } catch {
      setError('Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {
      type: blockForm.type,
      label: blockForm.label || undefined,
    }
    if (blockForm.type === 'vacation') {
      body.dateFrom = blockForm.dateFrom
      body.dateTo = blockForm.dateTo
    } else {
      if (!blockForm.recurringEnabled) {
        body.date = blockForm.date
      }
      if (blockForm.type === 'time') {
        body.startTime = blockForm.startTime
        body.endTime = blockForm.endTime
      }
      if (blockForm.recurringEnabled) {
        body.recurring = {
          type: blockForm.recurringType,
          ...(blockForm.recurringType === 'weekly' ? { dayOfWeek: blockForm.recurringDayOfWeek } : {}),
          ...(blockForm.recurringUntil ? { until: blockForm.recurringUntil } : {}),
        }
      }
    }
    try {
      const res = await fetch('/api/coach/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
      setBlockOpen(false)
      await loadSessions()
    } catch {
      setError('Помилка збереження блоку')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/coach/blocks/${blockId}`, { method: 'DELETE' })
      if (res.ok) {
        await loadSessions()
      } else {
        setError('Помилка видалення блоку')
      }
    } catch {
      setError('Помилка видалення блоку')
    }
  }

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
      const res = await fetch('/api/coach/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: form.clientId, scheduledAt, duration: Number(form.duration), type: form.type }),
      })
      const data = await res.json()
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
      setAddOpen(false)
      await loadSessions()
    } catch {
      setError('Помилка створення заняття')
    } finally {
      setSaving(false)
    }
  }

  function openEditModal(s: Session) {
    const d = new Date(s.scheduledAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    setError('')
    setEditForm({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      duration: String(s.duration),
      type: s.type,
    })
    setEditModal(s)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setSaving(true)
    setError('')
    try {
      const scheduledAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString()
      const res = await fetch(`/api/coach/sessions/${editModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt, duration: Number(editForm.duration), type: editForm.type }),
      })
      const data = await res.json()
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
      setEditModal(null)
      await loadSessions()
    } catch {
      setError('Помилка збереження заняття')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(sessionId: string, status: string) {
    setStatusChanging(true)
    setError('')
    try {
      const res = await fetch(`/api/coach/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setStatusModal(null)
        await loadSessions()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Помилка зміни статусу')
      }
    } catch {
      setError('Помилка зміни статусу')
    } finally {
      setStatusChanging(false)
    }
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

  function buildDayTimeline() {
    if (!selectedDay) return []
    const ds = dateStr(selectedDay)
    const dowKey = DOW_KEYS[selectedDay.getDay()] as DowKey
    const dayHours = workingHours[dowKey]
    if (!dayHours) return []
    const daySlots = generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration)
    return daySlots.map(slot => {
      const [h, m] = slot.split(':').map(Number)
      const session = selectedDaySessions.find(s => {
        const sd = new Date(s.scheduledAt)
        return sd.getHours() === h && sd.getMinutes() === m
      })
      const block = getSlotBlock(blocks, slot, ds, dowKey, dayHours.slotDuration)
      return { slot, session, block }
    })
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  const timeline = buildDayTimeline()

  return (
    <div className="space-y-4 pt-4">
      {/* Top buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={openScheduleModal}
          className="bg-white border border-gray-200 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ⚙️ Робочий графік
        </button>
        <button
          onClick={() => { setError(''); setBlockOpen(true) }}
          className="bg-white border border-gray-200 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          🚫 Заблокувати
        </button>
        <button
          onClick={() => { setError(''); setAddOpen(true) }}
          disabled={clients.length === 0}
          className="ml-auto bg-gray-900 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {clients.length === 0 ? 'Немає клієнтів' : '+ Заняття'}
        </button>
      </div>

      {/* Working hours summary */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 leading-relaxed">
        {workingHoursSummary(workingHours)}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&lsaquo;</button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&rsaquo;</button>
      </div>

      {/* Layout */}
      <div className="lg:flex lg:gap-4">
        {/* Calendar grid */}
        <div className="lg:flex-1">
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
                const ds = dateStr(day)
                const dowKey = DOW_KEYS[day.getDay()] as DowKey
                const fullyBlocked = isDayBlocked(blocks, ds, dowKey)
                const isWorkingDay = !!workingHours[dowKey]
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative flex flex-col items-center py-2 rounded-md text-sm transition-colors
                      ${isSelected ? 'bg-gray-900 text-white'
                        : fullyBlocked ? 'bg-red-50 text-red-400'
                        : isToday ? 'bg-gray-100 text-gray-900 font-semibold'
                        : !isWorkingDay ? 'text-gray-300'
                        : 'text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    {day.getDate()}
                    {fullyBlocked && !isSelected && (
                      <span className="text-xs leading-none">🚫</span>
                    )}
                    {!fullyBlocked && hasSessions && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </div>

        {/* Day panel */}
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

            {timeline.length === 0 ? (
              <GlassCard>
                <p className="text-sm text-gray-400 text-center py-4">Не робочий день</p>
              </GlassCard>
            ) : (
              <div className="space-y-1">
                {timeline.map(({ slot, session, block }) => (
                  <GlassCard key={slot} className="py-2 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-gray-500 shrink-0">{slot}</span>
                      {block ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="text-xs text-red-500 truncate">
                            🚫 {block.label ?? 'Заблоковано'}
                            {block.recurring && <span className="ml-1 text-gray-400">(recurring)</span>}
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(block._id)}
                            className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Видалити блок"
                          >
                            ✕
                          </button>
                        </div>
                      ) : session ? (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="text-xs text-gray-700 truncate">
                            {typeof session.clientId === 'object' ? session.clientId.name : '—'}
                          </span>
                          <div className="flex gap-2 shrink-0">
                            {session.status === 'scheduled' && (
                              <>
                                <button onClick={() => openEditModal(session)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                  ред.
                                </button>
                                <button onClick={() => { setError(''); setStatusModal(session) }} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                  статус
                                </button>
                              </>
                            )}
                            <Badge variant={STATUS_LABELS[session.status]?.variant ?? 'default'}>
                              {STATUS_LABELS[session.status]?.label ?? session.status}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">Вільно</span>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Working hours modal */}
      <GlassModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Робочий графік">
        <form onSubmit={handleSaveSchedule} className="space-y-3">
          {ALL_SCHEDULE_DAYS.map(({ key, label }) => {
            const d = scheduleForm[key]
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`day-${key}`}
                    checked={d.enabled}
                    onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], enabled: e.target.checked } }))}
                    className="rounded"
                  />
                  <label htmlFor={`day-${key}`} className="text-sm font-medium text-gray-700 w-28">{label}</label>
                  {d.enabled && (
                    <div className="flex gap-1 items-center text-xs text-gray-500">
                      <input
                        type="time"
                        value={d.start}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], start: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={d.end}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], end: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <input
                        type="number"
                        min="15" max="240"
                        value={d.slotDuration}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], slotDuration: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        title="Тривалість слоту (хв)"
                      />
                      <span>хв</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </form>
      </GlassModal>

      {/* Add block modal */}
      <GlassModal open={blockOpen} onClose={() => setBlockOpen(false)} title="Заблокувати час">
        <form onSubmit={handleAddBlock} className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['time', 'day', 'vacation'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setBlockForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  blockForm.type === t
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'time' ? 'Час' : t === 'day' ? 'День' : 'Відпустка'}
              </button>
            ))}
          </div>

          {blockForm.type === 'vacation' ? (
            <>
              <input type="date" required value={blockForm.dateFrom}
                onChange={e => setBlockForm(f => ({ ...f, dateFrom: e.target.value }))}
                placeholder="Від"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input type="date" required value={blockForm.dateTo}
                onChange={e => setBlockForm(f => ({ ...f, dateTo: e.target.value }))}
                placeholder="До"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </>
          ) : (
            <>
              {/* Recurring toggle */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring-toggle"
                  checked={blockForm.recurringEnabled}
                  onChange={e => setBlockForm(f => ({ ...f, recurringEnabled: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="recurring-toggle" className="text-sm text-gray-700">Повторюваний</label>
              </div>

              {blockForm.recurringEnabled ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(['daily', 'weekly'] as const).map(rt => (
                      <button key={rt} type="button"
                        onClick={() => setBlockForm(f => ({ ...f, recurringType: rt }))}
                        className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                          blockForm.recurringType === rt ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'
                        }`}
                      >
                        {rt === 'daily' ? 'Щодня' : 'Щотижня'}
                      </button>
                    ))}
                  </div>
                  {blockForm.recurringType === 'weekly' && (
                    <select value={blockForm.recurringDayOfWeek}
                      onChange={e => setBlockForm(f => ({ ...f, recurringDayOfWeek: e.target.value as DowKey }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                    >
                      {ALL_SCHEDULE_DAYS.map(({ key, label }) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  )}
                  <input type="date" value={blockForm.recurringUntil}
                    onChange={e => setBlockForm(f => ({ ...f, recurringUntil: e.target.value }))}
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder="До дати (необов'язково)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              ) : (
                <input type="date" required value={blockForm.date}
                  onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              )}

              {blockForm.type === 'time' && (
                <div className="flex gap-2">
                  <input type="time" required value={blockForm.startTime}
                    onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                  <span className="self-center text-gray-400">–</span>
                  <input type="time" required value={blockForm.endTime}
                    onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              )}
            </>
          )}

          <input type="text" value={blockForm.label}
            onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Назва (необов'язково)"
            maxLength={100}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Заблокувати'}
          </button>
        </form>
      </GlassModal>

      {/* Add session modal */}
      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Нове заняття">
        <form onSubmit={handleAddSession} className="space-y-3">
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} (@{c.nickname})</option>)}
          </select>
          <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <input type="time" required value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="15" max="480" value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="Тривалість (хв)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
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
        <GlassModal open={true} onClose={() => { setStatusModal(null); setError('') }} title="Статус заняття">
          <div className="space-y-2">
            <button onClick={() => handleStatusChange(statusModal._id, 'completed')} disabled={statusChanging}
              className={`w-full border border-green-300 text-green-700 rounded-md py-2.5 text-sm font-medium hover:bg-green-50 transition-colors${statusChanging ? ' opacity-50' : ''}`}>
              Позначити як проведене
            </button>
            <button onClick={() => handleStatusChange(statusModal._id, 'cancelled')} disabled={statusChanging}
              className={`w-full border border-red-300 text-red-700 rounded-md py-2.5 text-sm font-medium hover:bg-red-50 transition-colors${statusChanging ? ' opacity-50' : ''}`}>
              Скасувати заняття
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </GlassModal>
      )}

      {/* Edit session modal */}
      {editModal && (
        <GlassModal open={true} onClose={() => { setEditModal(null); setError('') }} title="Редагувати заняття">
          <form onSubmit={handleEdit} className="space-y-3">
            <input type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <input type="time" required value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="15" max="480" required value={editForm.duration}
                onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="Тривалість (хв)"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
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
