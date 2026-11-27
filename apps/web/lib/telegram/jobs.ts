import { User, Session, CoachProfile, TelegramChat, TelegramSent } from '@atleti/db'
import { formatKyiv } from '@/lib/tz'
import { sendMessage, escapeHtml, firstName } from './api'
import { getClientBalance } from './client-balance'
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
  // `$ne: false`, а не `true`: чати, прив'язані до появи перемикача, поля не мають.
  const chats = await TelegramChat.find({ userId: { $exists: true }, digestOn: { $ne: false } }).lean()
  const coaches = await User.find({ _id: { $in: chats.map(c => c.userId) }, role: 'coach' }).lean()
  const chatByUser = new Map(chats.map(c => [String(c.userId), c.chatId]))
  const date = formatKyiv(now, { weekday: 'long', day: 'numeric', month: 'long' })
  return inBatches(coaches, coach => sendOnce(`digest:${coach._id}:${day}`, chatByUser.get(String(coach._id))!, async () => {
    const sessions = await Session.find({
      coachId: coach._id, status: 'scheduled', scheduledAt: { $gte: start, $lt: end },
    }).sort({ scheduledAt: 1 }).lean()
    const clients = await User.find({ _id: { $in: sessions.map(s => s.clientId) } }, { name: 1 }).lean()
    const nameOf = new Map(clients.map(c => [String(c._id), c.name]))
    const body = sessions.length
      ? `🏋️ Занять сьогодні: <b>${sessions.length}</b>\n\n` + sessions.map(s =>
          `🕐 <b>${time(s.scheduledAt)}</b> — ${escapeHtml(nameOf.get(String(s.clientId)) ?? 'Клієнт')} ` +
          `(${TYPE_LABEL[s.type] ?? s.type}, ${s.duration} хв)`).join('\n')
      : '🌿 Записів на сьогодні немає — гарного вільного дня!'
    return `☀️ Доброго ранку, ${escapeHtml(firstName(coach.name))}!\n📅 Розклад на ${date}\n\n${body}`
  }))
}

export async function sendClientReminders(now: Date): Promise<number> {
  const chats = await TelegramChat.find({ userId: { $exists: true }, remindersOn: { $ne: false } }).lean()
  if (!chats.length) return 0
  const sessions = await Session.find({
    clientId: { $in: chats.map(c => c.userId) },
    status: 'scheduled',
    scheduledAt: { $gt: now, $lt: new Date(now.getTime() + MAX_LOOKAHEAD_MS) },
  }).lean()
  if (!sessions.length) return 0

  const profiles = await CoachProfile.find({ userId: { $in: sessions.map(s => s.coachId) } }).lean()
  const people = await User.find({ _id: { $in: [...sessions.map(s => s.coachId), ...sessions.map(s => s.clientId)] } }, { name: 1 }).lean()
  const nameOf = new Map(people.map(u => [String(u._id), u.name]))
  const chatByUser = new Map(chats.map(c => [String(c.userId), c.chatId]))
  const deadlineOf = new Map(profiles.map(p => [String(p.userId), p.cancellationDeadlineHours ?? 24]))
  const due = sessions.filter(s => isReminderDue(now, s.scheduledAt, deadlineOf.get(String(s.coachId)) ?? 24))
  // scheduledAt у ключі: перенесене заняття отримує власне нагадування.
  return inBatches(due, s => sendOnce(`remind:${s._id}:${s.scheduledAt.toISOString()}`, chatByUser.get(String(s.clientId))!, async () => {
    const deadlineHours = deadlineOf.get(String(s.coachId)) ?? 24
    const coach = nameOf.get(String(s.coachId)) ?? 'тренером'
    const client = firstName(nameOf.get(String(s.clientId)) ?? '')
    const when = formatKyiv(s.scheduledAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    const deadline = new Date(s.scheduledAt.getTime() - deadlineHours * 3600_000)
    // Не завжди 30: заняття могли записати чи перенести вже всередині вікна.
    const left = Math.max(1, Math.round((deadline.getTime() - now.getTime()) / 60_000))
    let text =
      (client ? `👋 ${escapeHtml(client)}, нагадуємо про заняття!\n\n` : '👋 Нагадуємо про заняття!\n\n') +
      `📅 <b>${when}</b>\n🏋️ з ${escapeHtml(coach)}\n\n` +
      `⏳ Скасувати без списання можна до <b>${time(deadline)}</b> — лишилось ${left} хв.`
    // «Останнє»: після цього заняття запланованих немає і залишок РІВНО нуль.
    // Від'ємний означає записане в борг — для нього окремий текст.
    const b = await getClientBalance(s.clientId, s.coachId)
    if (b && b.remainder === 0 && String(b.upcoming.at(-1)?._id) === String(s._id)) {
      text += '\n\n⚠️ Це <b>останнє</b> заняття на вашому балансі. Щоб продовжити тренування, поповніть баланс у тренера 💳'
    } else if (b && s.onDebt && b.remainder < 0 &&
      b.upcoming.length - b.upcoming.findIndex(u => String(u._id) === String(s._id)) <= -b.remainder) {
      // onDebt — знімок на момент запису. Поповнення гасить резерв за порядком дат,
      // тож неоплаченими лишаються лише останні |remainder| запланованих.
      text += '\n\n💸 Це заняття записане <b>в борг</b>. Будь ласка, оплатіть його тренеру.'
    }
    return text
  }))
}
