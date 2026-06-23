'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, GlassModal, Badge, TimePicker, DatePicker } from '@atleti/ui'
import { isDayBlocked, getTimeBlocksForDate } from '@/lib/slot-utils'
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

const TYPE_DOT: Record<string, string> = {
  regular: 'bg-atleti-slate',
  split: 'bg-amber-400',
  online: 'bg-blue-400',
  consultation: 'bg-emerald-400',
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

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function blockSummary(b: ICoachBlock): string {
  const rec = b.recurring ? (b.recurring.type === 'daily' ? ' · щодня' : ' · щотижня') : ''
  if (b.type === 'vacation') return `Відпустка · ${b.dateFrom}–${b.dateTo}`
  if (b.type === 'day') return `День${b.date ? ` · ${b.date}` : ''}${rec}`
  return `${b.startTime}–${b.endTime}${b.date ? ` · ${b.date}` : ''}${rec}`
}

type AgendaEntry =
  | { kind: 'free'; startMin: number; endMin: number }
  | { kind: 'session'; startMin: number; endMin: number; session: Session }
  | { kind: 'block'; startMin: number; endMin: number; block: ICoachBlock }

type DayAgenda =
  | { type: 'off' }
  | { type: 'blocked' }
  | { type: 'ok'; entries: AgendaEntry[] }

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
      body.dateFrom = blockForm.dateFrom || undefined
      body.dateTo = blockForm.dateTo || undefined
    } else {
      if (!blockForm.recurringEnabled) {
        body.date = blockForm.date || undefined
      }
      if (blockForm.type === 'time') {
        body.startTime = blockForm.startTime || undefined
        body.endTime = blockForm.endTime || undefined
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
    if (!form.date || !form.time) { setError('Оберіть дату і час'); return }
    setSaving(true)
    setError('')
    try {
      // Зберігаємо введений wall-clock як UTC (10:00 → ...T10:00:00.000Z)
      const scheduledAt = `${form.date}T${form.time}:00.000Z`
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
    // UTC wall-clock — читаємо ті самі компоненти, що зберігали
    setEditForm({
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      duration: String(s.duration),
      type: s.type,
    })
    setEditModal(s)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    if (!editForm.date || !editForm.time) { setError('Оберіть дату і час'); return }
    setSaving(true)
    setError('')
    try {
      const scheduledAt = `${editForm.date}T${editForm.time}:00.000Z`
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
  // Заняття зберігаються як UTC wall-clock → день рахуємо в UTC.
  // Скасовані не позначаємо — їхній час вважається вільним.
  const sessionUTCKey = (s: Session) => {
    const d = new Date(s.scheduledAt)
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
  }
  const daysWithSessions = new Set(
    sessions.filter(s => s.status !== 'cancelled').map(sessionUTCKey)
  )
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  // Заняття по днях (для десктоп-чипів), відсортовані за часом
  const sessionsByDay = new Map<string, Session[]>()
  for (const s of sessions) {
    if (s.status === 'cancelled') continue
    const key = sessionUTCKey(s)
    const arr = sessionsByDay.get(key) ?? []
    arr.push(s)
    sessionsByDay.set(key, arr)
  }
  for (const arr of sessionsByDay.values()) {
    arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  const selectedDaySessions = selectedDay
    ? sessions.filter(s => sessionUTCKey(s) === dayKey(selectedDay))
    : []

  function openAddAt(startMin: number, slotDuration: number) {
    if (!selectedDay) return
    setError('')
    setForm({
      clientId: clients[0]?.id ?? '',
      date: dateStr(selectedDay),
      time: fmtMin(startMin),
      duration: String(slotDuration),
      type: 'regular',
    })
    setAddOpen(true)
  }

  function buildDayAgenda(): DayAgenda {
    if (!selectedDay) return { type: 'off' }
    const ds = dateStr(selectedDay)
    const dowKey = DOW_KEYS[selectedDay.getDay()] as DowKey
    const dayHours = workingHours[dowKey]
    if (!dayHours) return { type: 'off' }
    if (isDayBlocked(blocks, ds, dowKey)) return { type: 'blocked' }

    const workStart = toMin(dayHours.start)
    const workEnd = toMin(dayHours.end)

    const occ: AgendaEntry[] = []
    for (const s of selectedDaySessions) {
      if (s.status === 'cancelled') continue
      const d = new Date(s.scheduledAt)
      const startMin = d.getUTCHours() * 60 + d.getUTCMinutes()
      occ.push({ kind: 'session', startMin, endMin: startMin + s.duration, session: s })
    }
    for (const b of getTimeBlocksForDate(blocks, ds, dowKey)) {
      if (!b.startTime || !b.endTime) continue
      occ.push({ kind: 'block', startMin: toMin(b.startTime), endMin: toMin(b.endTime), block: b })
    }
    occ.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

    const entries: AgendaEntry[] = []
    let cursor = workStart
    for (const e of occ) {
      if (e.startMin > cursor) entries.push({ kind: 'free', startMin: cursor, endMin: e.startMin })
      entries.push(e)
      cursor = Math.max(cursor, e.endMin)
    }
    if (cursor < workEnd) entries.push({ kind: 'free', startMin: cursor, endMin: workEnd })
    return { type: 'ok', entries }
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  const agenda = buildDayAgenda()
  const selectedDayHours = selectedDay ? workingHours[DOW_KEYS[selectedDay.getDay()] as DowKey] : undefined
  const selectedSlotDuration = selectedDayHours?.slotDuration ?? 60

  return (
    <div className="space-y-4 pt-4">
      {/* Top buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={openScheduleModal}
          className="bg-atleti-surface border border-atleti-line text-atleti-ink rounded-md px-3 py-2 text-sm font-medium shadow-soft hover:bg-atleti-mist/40 transition-colors"
        >
          ⚙️ Робочий графік
        </button>
        <button
          onClick={() => { setError(''); setBlockOpen(true) }}
          className="bg-atleti-surface border border-atleti-line text-atleti-ink rounded-md px-3 py-2 text-sm font-medium shadow-soft hover:bg-atleti-mist/40 transition-colors"
        >
          🚫 Заблокувати
        </button>
        <button
          onClick={() => { setError(''); setAddOpen(true) }}
          disabled={clients.length === 0}
          className="ml-auto bg-atleti-ink text-white rounded-md px-3 py-2 text-sm font-medium shadow-soft hover:bg-atleti-ink/90 transition-colors disabled:opacity-40"
        >
          {clients.length === 0 ? 'Немає клієнтів' : '+ Заняття'}
        </button>
      </div>

      {/* Working hours summary */}
      <div className="text-xs text-atleti-slate bg-atleti-surface border border-atleti-line rounded-md px-3 py-2 leading-relaxed">
        {workingHoursSummary(workingHours)}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-atleti-mist/40 transition-colors text-atleti-slate">&lsaquo;</button>
        <h1 className="text-lg font-display font-semibold text-atleti-ink">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-atleti-mist/40 transition-colors text-atleti-slate">&rsaquo;</button>
      </div>

      {/* Layout */}
      <div className="lg:flex lg:gap-4">
        {/* Calendar grid */}
        <div className="lg:flex-1">
          <GlassCard className="p-2">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_UA.map(d => (
                <div key={d} className="text-center text-xs font-medium text-atleti-muted py-1">{d}</div>
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
                const daySessions = sessionsByDay.get(dayKey(day)) ?? []
                const extra = daySessions.length - 3
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative flex flex-col items-center lg:items-stretch text-left rounded-md text-sm transition-colors
                      p-1 lg:p-1.5 min-h-0 lg:min-h-[6.5rem]
                      ${isSelected ? 'ring-2 ring-atleti-slate' : ''}
                      ${fullyBlocked ? 'bg-red-50 text-red-400'
                        : isToday ? 'bg-atleti-mist/50 font-semibold text-atleti-ink'
                        : !isWorkingDay ? 'text-atleti-muted hover:bg-atleti-mist/30'
                        : 'text-atleti-ink hover:bg-atleti-mist/30'}
                    `}
                  >
                    <span className="lg:self-start leading-none py-1 lg:py-0">{day.getDate()}</span>

                    {/* Мобільний індикатор */}
                    {fullyBlocked ? (
                      <span className="lg:hidden text-xs leading-none">🚫</span>
                    ) : hasSessions ? (
                      <span className="lg:hidden w-1 h-1 rounded-full mt-0.5 bg-atleti-slate" />
                    ) : null}

                    {/* Десктоп-чипи */}
                    {!fullyBlocked && daySessions.length > 0 && (
                      <div className="hidden lg:flex lg:flex-col gap-0.5 mt-1 w-full">
                        {daySessions.slice(0, 3).map(s => {
                          const d = new Date(s.scheduledAt)
                          const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
                          const name = typeof s.clientId === 'object' ? s.clientId.name : ''
                          return (
                            <span key={s._id} className="flex items-center gap-1 text-[11px] text-atleti-ink/80 bg-atleti-bg rounded px-1 py-0.5 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[s.type] ?? 'bg-atleti-muted'}`} />
                              <span className="font-medium shrink-0">{time}</span>
                              <span className="truncate text-atleti-slate">{name}</span>
                            </span>
                          )
                        })}
                        {extra > 0 && (
                          <span className="text-[10px] text-atleti-slate pl-1">ще {extra}</span>
                        )}
                      </div>
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

            {agenda.type === 'off' ? (
              <GlassCard>
                <p className="text-sm text-gray-400 text-center py-4">Не робочий день</p>
              </GlassCard>
            ) : agenda.type === 'blocked' ? (
              <GlassCard>
                <p className="text-sm text-red-400 text-center py-4">🚫 День заблоковано</p>
              </GlassCard>
            ) : (
              <div className="space-y-1.5">
                {agenda.entries.map((e, i) => {
                  const time = `${fmtMin(e.startMin)}–${fmtMin(e.endMin)}`
                  if (e.kind === 'free') {
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => openAddAt(e.startMin, selectedSlotDuration)}
                        disabled={clients.length === 0}
                        className="w-full flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <span className="text-xs font-mono text-gray-400 shrink-0">{time}</span>
                        <span className="text-xs text-green-600 flex-1">Вільно</span>
                        <span className="text-gray-400 text-base leading-none shrink-0">+</span>
                      </button>
                    )
                  }
                  if (e.kind === 'block') {
                    return (
                      <GlassCard key={i} className="py-2 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-gray-500 shrink-0">{time}</span>
                          <span className="text-xs text-red-500 truncate flex-1">
                            🚫 {e.block.label ?? 'Заблоковано'}
                            {e.block.recurring && <span className="ml-1 text-gray-400">(повтор.)</span>}
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(e.block._id)}
                            className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Видалити блок"
                          >
                            ✕
                          </button>
                        </div>
                      </GlassCard>
                    )
                  }
                  const s = e.session
                  const typeLabel = SESSION_TYPES.find(t => t.value === s.type)?.label ?? s.type
                  return (
                    <GlassCard key={i} className="py-2 px-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-gray-500 shrink-0">{time}</span>
                        <span className="text-xs text-gray-700 truncate flex-1">
                          {typeof s.clientId === 'object' ? s.clientId.name : '—'}
                          <span className="text-gray-400"> · {typeLabel}</span>
                        </span>
                        <div className="flex gap-2 shrink-0 items-center">
                          {s.status === 'scheduled' && (
                            <>
                              <button onClick={() => openEditModal(s)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                ред.
                              </button>
                              <button onClick={() => { setError(''); setStatusModal(s) }} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                статус
                              </button>
                            </>
                          )}
                          <Badge variant={STATUS_LABELS[s.status]?.variant ?? 'default'}>
                            {STATUS_LABELS[s.status]?.label ?? s.status}
                          </Badge>
                        </div>
                      </div>
                    </GlassCard>
                  )
                })}
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
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    id={`day-${key}`}
                    checked={d.enabled}
                    onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], enabled: e.target.checked } }))}
                    className="rounded"
                  />
                  <label htmlFor={`day-${key}`} className="text-sm font-medium text-atleti-ink w-24">{label}</label>
                  {d.enabled && (
                    <div className="flex gap-1 items-center text-xs text-gray-500">
                      <TimePicker
                        value={d.start}
                        onChange={v => setScheduleForm(f => ({ ...f, [key]: { ...f[key], start: v } }))}
                        className="w-20"
                      />
                      <span>–</span>
                      <TimePicker
                        value={d.end}
                        onChange={v => setScheduleForm(f => ({ ...f, [key]: { ...f[key], end: v } }))}
                        className="w-20"
                      />
                      <input
                        type="number"
                        min="15" max="240"
                        value={d.slotDuration}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], slotDuration: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        title="Слот, хв — крок бронювання для клієнта"
                      />
                      <span>хв</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-gray-400 leading-relaxed">
            Останнє поле <span className="font-medium text-gray-500">«Слот, хв»</span> — крок часу,
            з яким клієнт бачить вільні години для бронювання (напр. 60 хв).
          </p>
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
              <DatePicker value={blockForm.dateFrom}
                onChange={v => setBlockForm(f => ({ ...f, dateFrom: v }))}
                placeholder="Від"
              />
              <DatePicker value={blockForm.dateTo}
                onChange={v => setBlockForm(f => ({ ...f, dateTo: v }))}
                min={blockForm.dateFrom || undefined}
                placeholder="До"
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
                  <DatePicker value={blockForm.recurringUntil}
                    onChange={v => setBlockForm(f => ({ ...f, recurringUntil: v }))}
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder="До дати (необов'язково)"
                  />
                </div>
              ) : (
                <DatePicker value={blockForm.date}
                  onChange={v => setBlockForm(f => ({ ...f, date: v }))}
                  placeholder="Оберіть дату"
                />
              )}

              {blockForm.type === 'time' && (
                <div className="flex gap-2 items-center">
                  <TimePicker value={blockForm.startTime}
                    onChange={v => setBlockForm(f => ({ ...f, startTime: v }))}
                    className="flex-1"
                  />
                  <span className="self-center text-gray-400">–</span>
                  <TimePicker value={blockForm.endTime}
                    onChange={v => setBlockForm(f => ({ ...f, endTime: v }))}
                    className="flex-1"
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

        {blocks.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Мої блокування</p>
            {blocks.map(b => (
              <div key={b._id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
                <span className="text-xs text-gray-700 truncate">
                  {b.label && <span className="font-medium">{b.label} · </span>}
                  {blockSummary(b)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteBlock(b._id)}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  title="Видалити"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassModal>

      {/* Add session modal */}
      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Нове заняття">
        <form onSubmit={handleAddSession} className="space-y-3">
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} (@{c.nickname})</option>)}
          </select>
          <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))}
            min={new Date().toISOString().slice(0, 10)} placeholder="Оберіть дату" />
          <TimePicker value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} />
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
            <DatePicker value={editForm.date} onChange={v => setEditForm(f => ({ ...f, date: v }))}
              placeholder="Оберіть дату" />
            <TimePicker value={editForm.time} onChange={v => setEditForm(f => ({ ...f, time: v }))} />
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
