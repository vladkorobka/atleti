import { User, Session, CoachProfile, TelegramChat, TelegramSent } from '@atleti/db'
import { formatKyiv } from '@/lib/tz'
import { sendMessage, escapeHtml } from './api'
import { isReminderDue, isDigestHour, kyivDayRange, REMINDER_LEAD_MIN } from './schedule'

const TYPE_LABEL: Record<string, string> = {
  regular: 'Звичайне', split: 'Спліт', online: 'Онлайн', consultation: 'Консультація',
}
// Найдовший дедлайн, який дозволяє валідація профілю тренера (168 год), плюс запас.
const MAX_LOOKAHEAD_MS = (168 * 60 + REMINDER_LEAD_MIN + 60) * 60_000

// Ключ займається ДО відправки: два перекриті прогони cron не продублюють
// повідомлення. Якщо Telegram відмовив, ключ знімається — наступний прогін
// повторить, поки вікно (07:xx або 30 хв до дедлайну) ще відкрите. Обрив самої
// функції між вставкою і відправкою (таймаут, падіння інстансу) ключ НЕ знімає.
async function sendOnce(key: string, chatId: number, text: () => Promise<string> | string): Promise<boolean> {
  try {
    await TelegramSent.create({ key })
  } catch (e: any) {
    if (e?.code === 11000) return false
    throw e
  }
  let ok = false
  try {
    ok = await sendMessage(chatId, await text())
  } finally {
    if (!ok) await TelegramSent.deleteOne({ key })
  }
  return ok
}

// Порціями: послідовний fetch на кожного отримувача не влазить у таймаут
// функції, а все разом упирається в ліміт Telegram (~30 повідомлень/с).
async function inBatches<T>(items: T[], fn: (item: T) => Promise<boolean>): Promise<number> {
  let sent = 0
  for (let i = 0; i < items.length; i += 10) {
    const res = await Promise.allSettled(items.slice(i, i + 10).map(fn))
    for (const r of res) {
      if (r.status === 'fulfilled' && r.value) sent++
      else if (r.status === 'rejected') console.error('[telegram] send', r.reason)
    }
  }
  return sent
}

const time = (d: Date) => formatKyiv(d, { hour: '2-digit', minute: '2-digit' })

export async function sendCoachDigests(now: Date): Promise<number> {
  if (!isDigestHour(now)) return 0
  const { start, end, key: day } = kyivDayRange(now)
  const chats = await TelegramChat.find({ userId: { $exists: true } }).lean()
  const coaches = await User.find({ _id: { $in: chats.map(c => c.userId) }, role: 'coach' }).lean()
  const chatByUser = new Map(chats.map(c => [String(c.userId), c.chatId]))
  const date = formatKyiv(now, { weekday: 'long', day: 'numeric', month: 'long' })
  return inBatches(coaches, coach => sendOnce(`digest:${coach._id}:${day}`, chatByUser.get(String(coach._id))!, async () => {
    const sessions = await Session.find({
      coachId: coach._id, status: 'scheduled', scheduledAt: { $gte: start, $lt: end },
    }).sort({ scheduledAt: 1 }).lean()
    const clients = await User.find({ _id: { $in: sessions.map(s => s.clientId) } }, { name: 1 }).lean()
    const nameOf = (id: unknown) => clients.find(c => String(c._id) === String(id))?.name ?? 'Клієнт'
    const body = sessions.length
      ? sessions.map(s => `• <b>${time(s.scheduledAt)}</b> — ${escapeHtml(nameOf(s.clientId))} (${TYPE_LABEL[s.type] ?? s.type}, ${s.duration} хв)`).join('\n')
      : 'Записів на сьогодні немає.'
    return `☀️ Розклад на ${date}\n\n${body}`
  }))
}

export async function sendClientReminders(now: Date): Promise<number> {
  const chats = await TelegramChat.find({ userId: { $exists: true } }).lean()
  if (!chats.length) return 0
  const sessions = await Session.find({
    clientId: { $in: chats.map(c => c.userId) },
    status: 'scheduled',
    scheduledAt: { $gt: now, $lt: new Date(now.getTime() + MAX_LOOKAHEAD_MS) },
  }).lean()
  if (!sessions.length) return 0

  const profiles = await CoachProfile.find({ userId: { $in: sessions.map(s => s.coachId) } }).lean()
  const coaches = await User.find({ _id: { $in: sessions.map(s => s.coachId) } }, { name: 1 }).lean()
  const chatByUser = new Map(chats.map(c => [String(c.userId), c.chatId]))
  const deadlineOf = new Map(profiles.map(p => [String(p.userId), p.cancellationDeadlineHours ?? 24]))
  const due = sessions.filter(s => isReminderDue(now, s.scheduledAt, deadlineOf.get(String(s.coachId)) ?? 24))
  // scheduledAt у ключі: перенесене заняття отримує власне нагадування.
  return inBatches(due, s => sendOnce(`remind:${s._id}:${s.scheduledAt.toISOString()}`, chatByUser.get(String(s.clientId))!, () => {
    const deadlineHours = deadlineOf.get(String(s.coachId)) ?? 24
    const coach = coaches.find(c => String(c._id) === String(s.coachId))?.name ?? 'тренер'
    const when = formatKyiv(s.scheduledAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    const deadline = new Date(s.scheduledAt.getTime() - deadlineHours * 3600_000)
    // Не завжди 30: заняття могли записати чи перенести вже всередині вікна.
    const left = Math.max(1, Math.round((deadline.getTime() - now.getTime()) / 60_000))
    return `⏰ Нагадування: заняття <b>${when}</b> з ${escapeHtml(coach)}.\n` +
      `Скасувати без списання можна до <b>${time(deadline)}</b> — лишилось ${left} хв.`
  }))
}
