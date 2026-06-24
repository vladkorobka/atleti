'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard, GlassModal, Badge, DatePicker, TimePicker, CenteredSpinner, Toggle, Select, ConfirmDialog, Button, Input, BanIcon } from '@atleti/ui'
import { toast } from 'sonner'
import { generateSlots, isDayBlocked, getSlotBlock } from '@/lib/slot-utils'
import { kyivInputToUtc, kyivParts, kyivDateInput } from '@/lib/tz'
import type { ICoachBlock, DowKey, IWorkingHoursDay } from '@atleti/types'

interface Client { id: string; name: string; nickname: string; remaining: number }
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

// Кольоровий лейбл типу заняття (спліт виділяється фіолетовим)
const SESSION_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  regular: { label: 'Тренування', cls: 'bg-blue-100 text-blue-700' },
  split: { label: 'Спліт', cls: 'bg-purple-100 text-purple-700' },
  online: { label: 'Онлайн', cls: 'bg-teal-100 text-teal-700' },
  consultation: { label: 'Консультація', cls: 'bg-amber-100 text-amber-700' },
}

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

function blockSummary(b: ICoachBlock): string {
  const rec = b.recurring ? (b.recurring.type === 'daily' ? ' · щодня' : ' · щотижня') : ''
  if (b.type === 'vacation') return `Відпустка · ${b.dateFrom}–${b.dateTo}`
  if (b.type === 'day') return `День${b.date ? ` · ${b.date}` : ''}${rec}`
  return `${b.startTime}–${b.endTime}${b.date ? ` · ${b.date}` : ''}${rec}`
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarClient({ clients }: { clients: Client[] }) {
  const router = useRouter()
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
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

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
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

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
      const url = editingBlockId ? `/api/coach/blocks/${editingBlockId}` : '/api/coach/blocks'
      const res = await fetch(url, {
        method: editingBlockId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
      setEditingBlockId(null)
      resetBlockForm()
      setBlockOpen(false)
      await loadSessions()
    } catch {
      setError('Помилка збереження блоку')
    } finally {
      setSaving(false)
    }
  }

  function resetBlockForm() {
    setBlockForm({
      type: 'time', date: '', startTime: '', endTime: '', dateFrom: '', dateTo: '', label: '',
      recurringEnabled: false, recurringType: 'daily', recurringDayOfWeek: 'mon', recurringUntil: '',
    })
  }

  function openAddBlock() {
    setError('')
    setEditingBlockId(null)
    resetBlockForm()
    setBlockOpen(true)
  }

  function openEditBlock(b: ICoachBlock) {
    setError('')
    setEditingBlockId(b._id)
    setBlockForm({
      type: b.type,
      date: b.date ?? '',
      startTime: b.startTime ?? '',
      endTime: b.endTime ?? '',
      dateFrom: b.dateFrom ?? '',
      dateTo: b.dateTo ?? '',
      label: b.label ?? '',
      recurringEnabled: !!b.recurring,
      recurringType: b.recurring?.type ?? 'daily',
      recurringDayOfWeek: (b.recurring?.dayOfWeek as DowKey) ?? 'mon',
      recurringUntil: b.recurring?.until ?? '',
    })
    setBlockOpen(true)
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/coach/blocks/${blockId}`, { method: 'DELETE' })
      if (res.ok) {
        if (editingBlockId === blockId) { setEditingBlockId(null); resetBlockForm() }
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
      const scheduledAt = kyivInputToUtc(form.date, form.time).toISOString()
      const res = await fetch('/api/coach/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: form.clientId, scheduledAt, duration: Number(form.duration), type: form.type }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Помилка'
        setError(msg)
        toast.error(msg)
        return
      }
      setAddOpen(false)
      toast.success('Заняття додано')
      await loadSessions()
      router.refresh()
    } catch {
      setError('Помилка створення заняття')
      toast.error('Помилка створення заняття')
    } finally {
      setSaving(false)
    }
  }

  // Клік на вільний слот у розкладі дня — відкриваємо "Нове заняття" з підставленими датою/часом
  function openAddForSlot(slot: string) {
    if (!selectedDay) return
    if (clients.length === 0) return
    setError('')
    setForm(f => ({ ...f, date: dateStr(selectedDay), time: slot }))
    setAddOpen(true)
  }

  function openEditModal(s: Session) {
    const p = kyivParts(new Date(s.scheduledAt))
    const pad = (n: number) => String(n).padStart(2, '0')
    setError('')
    setEditForm({
      date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
      time: `${pad(p.hour)}:${pad(p.minute)}`,
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
      const scheduledAt = kyivInputToUtc(editForm.date, editForm.time).toISOString()
      const res = await fetch(`/api/coach/sessions/${editModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt, duration: Number(editForm.duration), type: editForm.type }),
      })
      const data = await res.json()
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
      setEditModal(null)
      await loadSessions()
      router.refresh()
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
        toast.success('Статус заняття оновлено')
        await loadSessions()
        // інвалідовуємо Router Cache, щоб баланс/дашборди на сусідніх сторінках були свіжі
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data.error === 'string' ? data.error : 'Помилка зміни статусу'
        setError(msg)
        toast.error(msg)
      }
    } catch {
      setError('Помилка зміни статусу')
      toast.error('Помилка зміни статусу')
    } finally {
      setStatusChanging(false)
    }
  }

  // Скасування заняття тренером = видалення з розкладу (з рефандом балансу, якщо було проведене).
  async function handleDeleteSession(sessionId: string) {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/coach/sessions/${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setConfirmDeleteSession(null)
        setStatusModal(null)
        toast.success('Заняття скасовано')
        await loadSessions()
        router.refresh()
      } else {
        toast.error('Не вдалося скасувати заняття')
      }
    } catch {
      toast.error('Помилка скасування заняття')
    } finally {
      setDeleting(false)
    }
  }

  const grid = getMonthGrid(year, month)
  // ключ календарного дня в київському поясі (місяць 0-based — узгоджено з grid getMonth())
  const kyivDayKey = (d: Date) => { const p = kyivParts(d); return `${p.year}-${p.month - 1}-${p.day}` }
  const isSameKyivDay = (date: Date, gridDay: Date) => {
    const p = kyivParts(date)
    return p.year === gridDay.getFullYear() && p.month - 1 === gridDay.getMonth() && p.day === gridDay.getDate()
  }
  const daysWithSessions = new Set(sessions.map(s => kyivDayKey(new Date(s.scheduledAt))))
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const selectedDaySessions = selectedDay
    ? sessions.filter(s => isSameKyivDay(new Date(s.scheduledAt), selectedDay))
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
      // усі заняття цього слоту (для спліту їх кілька — різні клієнти)
      const slotSessions = selectedDaySessions.filter(s => {
        const p = kyivParts(new Date(s.scheduledAt))
        return p.hour === h && p.minute === m
      })
      const block = getSlotBlock(blocks, slot, ds, dowKey, dayHours.slotDuration)
      return { slot, slotSessions, block }
    })
  }

  // Межі робочого графіку для обраної дати — щоб у виборі часу показувати лише робочі години.
  function hoursForDate(d: string): { minTime?: string; maxTime?: string } {
    if (!d) return {}
    const [y, m, dd] = d.split('-').map(Number)
    if (!y || !m || !dd) return {}
    const dow = DOW_KEYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] as DowKey
    const h = workingHours[dow]
    return h ? { minTime: h.start, maxTime: h.end } : {}
  }

  if (loading) return <CenteredSpinner />

  const timeline = buildDayTimeline()
  // Обраний у модалці клієнт без вільних занять на балансі — блокуємо створення.
  const selectedClientNoBalance = (clients.find(c => c.id === form.clientId)?.remaining ?? 0) <= 0

  return (
    <div className="space-y-4 pt-4">
      {/* Top action bar — glass-сегментована панель, mobile-first */}
      <div className="flex items-center gap-2 rounded-md border border-white/40 bg-white/60 p-1.5 shadow-sm backdrop-blur-sm">
        <button
          onClick={openScheduleModal}
          aria-label="Робочий графік"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white/70 active:bg-white/80"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">Графік</span>
        </button>
        <button
          onClick={openAddBlock}
          aria-label="Заблокувати час"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white/70 active:bg-white/80"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m5.6 5.6 12.8 12.8" />
          </svg>
          <span className="hidden sm:inline">Блок</span>
        </button>
        <button
          onClick={() => { setError(''); setAddOpen(true) }}
          disabled={clients.length === 0}
          className="ml-auto flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 active:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          {clients.length > 0 && (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          <span className="truncate">{clients.length === 0 ? 'Немає клієнтів' : 'Заняття'}</span>
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&lsaquo;</button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&rsaquo;</button>
      </div>

      {/* Layout — розклад дня під календарем (як на mobile) */}
      <div className="space-y-4">
        {/* Calendar grid */}
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
                      <BanIcon className="h-3 w-3 text-red-400" />
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

        {/* Day panel — завжди під календарем */}
        {selectedDay && (
          <div>
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
                {timeline.map(({ slot, slotSessions, block }) => (
                  <GlassCard key={slot} className="py-2 px-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono text-gray-500 shrink-0 pt-1">{slot}</span>
                      {block ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="flex min-w-0 items-center gap-1 text-xs text-red-500 truncate">
                            <BanIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{block.label ?? 'Заблоковано'}
                            {block.recurring && <span className="ml-1 text-gray-400">(recurring)</span>}</span>
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(block._id)}
                            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                            title="Видалити блок"
                            aria-label="Видалити блок"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </div>
                      ) : slotSessions.length > 0 ? (
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {slotSessions.length > 1 && (
                            <p className="text-[10px] font-medium text-purple-600">Спліт · {slotSessions.length} клієнти</p>
                          )}
                          {slotSessions.map(session => {
                            const tb = SESSION_TYPE_BADGE[session.type] ?? { label: session.type, cls: 'bg-gray-100 text-gray-600' }
                            return (
                              <div key={session._id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tb.cls}`}>{tb.label}</span>
                                  <span className="text-xs text-gray-700 truncate">
                                    {typeof session.clientId === 'object' ? session.clientId.name : '—'}
                                  </span>
                                </div>
                                <div className="flex gap-2 shrink-0 items-center">
                                  {session.status === 'scheduled' && (
                                    <button onClick={() => openEditModal(session)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                      ред.
                                    </button>
                                  )}
                                  <button onClick={() => { setError(''); setStatusModal(session) }} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                    статус
                                  </button>
                                  <Badge variant={STATUS_LABELS[session.status]?.variant ?? 'default'}>
                                    {STATUS_LABELS[session.status]?.label ?? session.status}
                                  </Badge>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAddForSlot(slot)}
                          disabled={clients.length === 0}
                          className="flex-1 text-left text-xs text-green-600 hover:text-green-700 pt-1 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          + Вільно — запланувати
                        </button>
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
              <div key={key} className="flex items-center gap-3 min-h-[2.5rem]">
                <Toggle
                  checked={d.enabled}
                  onChange={v => setScheduleForm(f => ({ ...f, [key]: { ...f[key], enabled: v } }))}
                />
                <span className="text-sm font-medium text-gray-700 w-20 shrink-0">{label}</span>
                {d.enabled ? (
                  <div className="flex gap-2 items-center ml-auto">
                    <TimePicker
                      value={d.start}
                      onChange={v => setScheduleForm(f => ({ ...f, [key]: { ...f[key], start: v } }))}
                      className="w-[4.5rem]"
                    />
                    <span className="text-gray-400">–</span>
                    <TimePicker
                      value={d.end}
                      onChange={v => setScheduleForm(f => ({ ...f, [key]: { ...f[key], end: v } }))}
                      className="w-[4.5rem]"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 ml-auto">Вихідний</span>
                )}
              </div>
            )
          })}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" loading={saving} fullWidth size="lg">
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </form>
      </GlassModal>

      {/* Add block modal */}
      <GlassModal
        open={blockOpen}
        onClose={() => { setBlockOpen(false); setEditingBlockId(null); resetBlockForm(); setError('') }}
        title={editingBlockId ? 'Редагувати блок' : 'Заблокувати час'}
      >
        {/* Список наявних блоків — перегляд / редагування / видалення */}
        {blocks.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-xs font-medium text-gray-500">Заблоковані час/дні</p>
            {blocks.map(b => (
              <div
                key={b._id}
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs ${
                  editingBlockId === b._id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-gray-700">
                  <BanIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{blockSummary(b)}{b.label ? ` — ${b.label}` : ''}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => openEditBlock(b)} className="text-gray-400 hover:text-gray-700 underline">ред.</button>
                  <button type="button" onClick={() => handleDeleteBlock(b._id)} className="text-gray-400 hover:text-red-500" title="Видалити" aria-label="Видалити">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                placeholder="До"
              />
            </>
          ) : (
            <>
              {/* Recurring toggle */}
              <Toggle
                checked={blockForm.recurringEnabled}
                onChange={v => setBlockForm(f => ({ ...f, recurringEnabled: v }))}
                label="Повторюваний"
              />

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
                    <Select
                      value={blockForm.recurringDayOfWeek}
                      onChange={v => setBlockForm(f => ({ ...f, recurringDayOfWeek: v as DowKey }))}
                      options={ALL_SCHEDULE_DAYS.map(({ key, label }) => ({ value: key, label }))}
                    />
                  )}
                  <DatePicker value={blockForm.recurringUntil}
                    onChange={v => setBlockForm(f => ({ ...f, recurringUntil: v }))}
                    min={kyivDateInput(new Date())}
                    placeholder="До дати (необов'язково)"
                  />
                </div>
              ) : (
                <DatePicker value={blockForm.date}
                  onChange={v => setBlockForm(f => ({ ...f, date: v }))}
                  min={kyivDateInput(new Date())}
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

          <Input type="text" value={blockForm.label}
            onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Назва (необов'язково)"
            maxLength={100}
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" loading={saving} fullWidth size="lg">
            {saving ? 'Збереження...' : editingBlockId ? 'Зберегти зміни' : 'Заблокувати'}
          </Button>
        </form>
      </GlassModal>

      {/* Add session modal */}
      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Нове заняття">
        <form onSubmit={handleAddSession} className="space-y-3">
          <Select
            value={form.clientId}
            onChange={v => setForm(f => ({ ...f, clientId: v }))}
            options={clients.map(c => ({
              value: c.id,
              label: `${c.name} (@${c.nickname}) · ${c.remaining > 0 ? `${c.remaining} зан.` : 'немає занять'}`,
            }))}
            placeholder="Оберіть клієнта"
          />
          <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} min={kyivDateInput(new Date())} />
          <TimePicker value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} {...hoursForDate(form.date)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min="15" max="480" value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="Тривалість (хв)" />
            <Select
              value={form.type}
              onChange={v => setForm(f => ({ ...f, type: v }))}
              options={SESSION_TYPES}
            />
          </div>
          {selectedClientNoBalance && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              У клієнта немає вільних занять на балансі. Поповніть баланс, щоб запланувати заняття.
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" loading={saving} disabled={saving || selectedClientNoBalance} fullWidth size="lg">
            {saving ? 'Збереження...' : 'Додати заняття'}
          </Button>
        </form>
      </GlassModal>

      {/* Status change modal */}
      {statusModal && (
        <GlassModal open={true} onClose={() => { setStatusModal(null); setError('') }} title="Статус заняття">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Поточний статус: <span className="font-medium">{STATUS_LABELS[statusModal.status]?.label ?? statusModal.status}</span>
            </p>
            {statusModal.status !== 'scheduled' && (
              <Button variant="ghost" onClick={() => handleStatusChange(statusModal._id, 'scheduled')} disabled={statusChanging}
                fullWidth size="lg"
                className="border border-amber-300 text-amber-700 hover:bg-amber-50 active:bg-amber-100">
                Повернути в заплановані
              </Button>
            )}
            {statusModal.status !== 'completed' && (
              <Button variant="ghost" onClick={() => handleStatusChange(statusModal._id, 'completed')} disabled={statusChanging}
                fullWidth size="lg"
                className="border border-green-300 text-green-700 hover:bg-green-50 active:bg-green-100">
                Позначити як проведене
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirmDeleteSession(statusModal)} disabled={statusChanging}
              fullWidth size="lg"
              className="border border-red-300 text-red-700 hover:bg-red-50 active:bg-red-100">
              Скасувати заняття
            </Button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </GlassModal>
      )}

      {/* Edit session modal */}
      {editModal && (
        <GlassModal open={true} onClose={() => { setEditModal(null); setError('') }} title="Редагувати заняття">
          <form onSubmit={handleEdit} className="space-y-3">
            <DatePicker value={editForm.date} onChange={v => setEditForm(f => ({ ...f, date: v }))} />
            <TimePicker value={editForm.time} onChange={v => setEditForm(f => ({ ...f, time: v }))} {...hoursForDate(editForm.date)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="15" max="480" required value={editForm.duration}
                onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="Тривалість (хв)" />
              <Select
                value={editForm.type}
                onChange={v => setEditForm(f => ({ ...f, type: v }))}
                options={SESSION_TYPES}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button type="submit" loading={saving} fullWidth size="lg">
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          </form>
        </GlassModal>
      )}

      {/* Confirm session cancellation (delete) */}
      <ConfirmDialog
        open={confirmDeleteSession !== null}
        title="Скасувати заняття?"
        message="Заняття буде видалено з розкладу. Якщо воно вже проведене — списане заняття повернеться на баланс клієнта."
        confirmLabel="Скасувати заняття"
        cancelLabel="Назад"
        danger
        loading={deleting}
        onConfirm={() => confirmDeleteSession && handleDeleteSession(confirmDeleteSession._id)}
        onClose={() => setConfirmDeleteSession(null)}
      />
    </div>
  )
}
