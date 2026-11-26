import bcrypt from 'bcryptjs'
import { User, TelegramChat, TelegramLoginFail, type ITelegramChat } from '@atleti/db'
import { formatKyiv } from '@/lib/tz'
import { pluralSessions } from '@/lib/balance'
import { sendMessage, deleteMessage, escapeHtml, firstName } from './api'
import { getClientBalance } from './client-balance'
import { settlePastSessions } from '@/lib/settle-sessions'

const MAX_FAILS_PER_CHAT = 5
const MAX_FAILS_PER_ACCOUNT = 10
// Порівняння з цим хешем, коли акаунта нема: інакше за часом відповіді видно,
// чи існує нікнейм (bcrypt — це ~50-100 мс, яких без нього не було б).
const DUMMY_HASH = bcrypt.hashSync('atleti-telegram-dummy', 10)

export interface TgUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    text?: string
  }
}

type Role = 'coach' | 'client'
type LinkedUser = { _id: unknown; name: string; role: Role }

const BTN = {
  balance: '💰 Баланс',
  remindersOn: '🔔 Нагадування: увімкнено',
  remindersOff: '🔕 Нагадування: вимкнено',
  digestOn: '🔔 Дайджест: увімкнено',
  digestOff: '🔕 Дайджест: вимкнено',
} as const

const LOCKED = '⛔ Забагато невдалих спроб. Спробуйте за 15 хвилин.'

function keyboard(role: Role, chat: Pick<ITelegramChat, 'remindersOn' | 'digestOn'>) {
  const rows = role === 'client'
    ? [[BTN.balance], [chat.remindersOn !== false ? BTN.remindersOn : BTN.remindersOff]]
    : [[chat.digestOn !== false ? BTN.digestOn : BTN.digestOff]]
  return { keyboard: rows.map(r => r.map(text => ({ text }))), resize_keyboard: true, is_persistent: true }
}

function statusText(role: Role, chat: Pick<ITelegramChat, 'remindersOn' | 'digestOn'>): string {
  if (role === 'coach') {
    return chat.digestOn !== false
      ? '☀️ Щоранку о 07:00 надсилатиму розклад на день.'
      : '🔕 Ранковий дайджест вимкнено — увімкнути можна кнопкою нижче.'
  }
  return chat.remindersOn !== false
    ? '⏰ Нагадуватиму про заняття за 30 хв до дедлайну скасування.'
    : '🔕 Нагадування вимкнено — увімкнути можна кнопкою нижче.'
}

async function isLocked(chatId: number, targetUserId?: string): Promise<boolean> {
  if ((await TelegramLoginFail.countDocuments({ chatId })) >= MAX_FAILS_PER_CHAT) return true
  return !!targetUserId &&
    (await TelegramLoginFail.countDocuments({ targetUserId })) >= MAX_FAILS_PER_ACCOUNT
}

// Схоже на пошту — спершу пошта, потім нікнейм: формат нікнейма не обмежений,
// і «a@b» може бути саме нікнеймом. «@nick» — нікнейм у звичній для Telegram формі.
async function findByLogin(login: string) {
  const v = login.toLowerCase()
  if (/^[^@\s]+@[^@\s]+$/.test(v)) {
    const byEmail = await User.findOne({ email: v }, { _id: 1 }).lean()
    if (byEmail) return byEmail
  }
  return User.findOne({ nickname: v.replace(/^@/, '') }, { _id: 1 }).lean()
}

async function balanceText(user: LinkedUser): Promise<string> {
  // Як /api/client/balance: минулі заплановані спершу закриваються, інакше бот і сайт показують різні числа.
  await settlePastSessions({ clientId: String(user._id) })
  const b = await getClientBalance(user._id)
  if (!b) return '🤷 У вас поки немає активного тренера.'
  const lines = [`💰 <b>${escapeHtml(firstName(user.name))}, ваш баланс</b>`, '']
  lines.push(`✅ Доступно для запису: <b>${b.available}</b> ${pluralSessions(b.available)}`)
  if (b.debt > 0) lines.push(`⚠️ Борг: <b>${b.debt}</b> ${pluralSessions(b.debt)}`)
  lines.push(`📅 Заплановано: <b>${b.upcoming.length}</b> ${pluralSessions(b.upcoming.length)}`)
  for (const s of b.upcoming.slice(0, 10)) {
    lines.push(`   • ${formatKyiv(s.scheduledAt, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`)
  }
  if (b.upcoming.length > 10) lines.push(`   …і ще ${b.upcoming.length - 10}`)
  return lines.join('\n')
}

async function handleLinked(chatId: number, text: string, chat: ITelegramChat): Promise<void> {
  const user = await User.findById(chat.userId).lean() as LinkedUser | null
  if (!user) {
    // Акаунт видалили на сайті: прив'язка мертва, починаємо спочатку.
    await TelegramChat.updateOne({ chatId }, { $unset: { userId: 1 } })
    await sendMessage(chatId, '👋 Надішліть нікнейм або пошту з Атлеті.', { remove_keyboard: true })
    return
  }
  const name = escapeHtml(firstName(user.name))

  if (user.role === 'client' && text === BTN.balance) {
    await sendMessage(chatId, await balanceText(user), keyboard(user.role, chat))
    return
  }

  const toggle =
    user.role === 'client' && (text === BTN.remindersOn || text === BTN.remindersOff) ? 'remindersOn'
    : user.role === 'coach' && (text === BTN.digestOn || text === BTN.digestOff) ? 'digestOn'
    : null
  if (toggle) {
    // Нове значення — від поточного в БД, а не від тексту кнопки: стара клавіатура
    // в іншому місці чату могла показувати застарілий стан.
    const updated = await TelegramChat.findOneAndUpdate(
      { chatId },
      [{ $set: { [toggle]: { $eq: [{ $ifNull: [`$${toggle}`, true] }, false] } } }],
      { new: true }
    ).lean()
    await sendMessage(chatId, statusText(user.role, updated!), keyboard(user.role, updated!))
    return
  }

  // /start або будь-який текст: нагадуємо, хто ти і що вміє бот, і повертаємо клавіатуру.
  await sendMessage(chatId,
    `👋 ${name}, ви підключені до Атлеті.\n${statusText(user.role, chat)}\n\n/stop — відв'язати акаунт.`,
    keyboard(user.role, chat))
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message
  if (!msg?.text || msg.chat.type !== 'private') return
  const chatId = msg.chat.id
  const text = msg.text.trim()

  const chat = await TelegramChat.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { chatId } },
    { upsert: true, new: true }
  ).lean()

  if (text === '/stop') {
    await TelegramChat.updateOne({ chatId }, { $unset: { userId: 1, pendingUserId: 1 }, $set: { awaitingPassword: false } })
    await sendMessage(chatId, '👋 Акаунт відв\'язано, сповіщень більше не буде. /start — підключити знову.', { remove_keyboard: true })
    return
  }

  if (chat.userId) {
    await handleLinked(chatId, text, chat)
    return
  }

  // Кнопка зі старої клавіатури в уже неприв'язаному чаті (акаунт перепривʼязали
  // з іншого Telegram): це не логін і не пароль — інакше натискання з'їдали б спроби.
  if ((Object.values(BTN) as string[]).includes(text)) {
    await sendMessage(chatId, '👋 Надішліть нікнейм або пошту з Атлеті.', { remove_keyboard: true })
    return
  }

  if (text === '/start') {
    await TelegramChat.updateOne({ chatId }, { $unset: { pendingUserId: 1 }, $set: { awaitingPassword: false } })
    await sendMessage(chatId, '👋 Вітаю! Це бот Атлеті 💪\nНадішліть свій нікнейм або пошту з Атлеті.')
    return
  }

  if (!chat.awaitingPassword) {
    if (await isLocked(chatId)) {
      // Під блокуванням людина може вводити що завгодно, зокрема пароль.
      await deleteMessage(chatId, msg.message_id)
      await sendMessage(chatId, LOCKED)
      return
    }
    const user = await findByLogin(text)
    await TelegramChat.updateOne({ chatId }, user
      ? { $set: { awaitingPassword: true, pendingUserId: user._id } }
      : { $set: { awaitingPassword: true }, $unset: { pendingUserId: 1 } })
    await sendMessage(chatId, '🔑 Тепер надішліть пароль від Атлеті. Повідомлення з паролем я одразу видалю.')
    return
  }

  // Крок пароля: прибираємо його з історії чату незалежно від результату.
  await deleteMessage(chatId, msg.message_id)
  // Крок забирається атомарно ДО перевірок: Telegram шле вебхуки паралельно, і
  // пачка паролів після одного нікнейма інакше дала б N спроб повз ліміти.
  const step = await TelegramChat.findOneAndUpdate(
    { chatId, awaitingPassword: true },
    { $set: { awaitingPassword: false }, $unset: { pendingUserId: 1 } },
    { new: false }
  ).lean()
  if (!step) {
    await sendMessage(chatId, 'Надішліть нікнейм або пошту ще раз.')
    return
  }

  const targetUserId = step.pendingUserId ? String(step.pendingUserId) : undefined
  if (await isLocked(chatId, targetUserId)) {
    await sendMessage(chatId, LOCKED)
    return
  }

  // Спроба пишеться ДО bcrypt і знімається при успіху: інакше паралельні спроби
  // в польоті не бачать одна одну в лічильнику isLocked.
  const attempt = await TelegramLoginFail.create({ chatId, targetUserId })

  // passwordHash є в схемі, але не в IUser — той самий міст, що в lib/auth.ts.
  const user = targetUserId
    ? (await User.findById(targetUserId).lean()) as (LinkedUser & { passwordHash?: string } | null)
    : null
  // Однакова відповідь і однаковий час для «немає такого» і «не той пароль».
  const ok = await bcrypt.compare(text, user?.passwordHash ?? DUMMY_HASH) && !!user?.passwordHash

  if (!ok || !user) {
    await sendMessage(chatId,
      'Введені дані не вірні. Надішліть нікнейм або пошту ще раз')
    return
  }

  await TelegramLoginFail.deleteOne({ _id: attempt._id })
  await TelegramChat.updateOne({ userId: user._id, chatId: { $ne: chatId } }, { $unset: { userId: 1 } })
  const linked = await TelegramChat.findOneAndUpdate({ chatId }, { $set: { userId: user._id } }, { new: true }).lean()
  await sendMessage(chatId,
    `🎉 Готово, ${escapeHtml(firstName(user.name))}! Акаунт підключено.\n${statusText(user.role, linked!)}\n\n/stop — відв'язати акаунт.`,
    keyboard(user.role, linked!))
}
