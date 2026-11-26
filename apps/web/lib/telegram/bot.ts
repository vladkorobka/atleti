import bcrypt from 'bcryptjs'
import { User, TelegramChat, TelegramLoginFail } from '@atleti/db'
import { sendMessage, deleteMessage, escapeHtml } from './api'

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

const ROLE_TEXT = {
  coach: 'Ви — тренер. Щодня о 07:00 надсилатиму розклад на день.',
  client: 'Ви — клієнт. Нагадуватиму про заняття за 30 хв до дедлайну скасування.',
} as const

async function isLocked(chatId: number, targetUserId?: string): Promise<boolean> {
  if ((await TelegramLoginFail.countDocuments({ chatId })) >= MAX_FAILS_PER_CHAT) return true
  return !!targetUserId &&
    (await TelegramLoginFail.countDocuments({ targetUserId })) >= MAX_FAILS_PER_ACCOUNT
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
    await sendMessage(chatId, 'Акаунт відв\'язано, сповіщень більше не буде. /start — підключити знову.')
    return
  }

  if (text === '/start') {
    if (chat.userId) {
      const user = await User.findById(chat.userId).lean()
      if (user) {
        await sendMessage(chatId, `Ви вже підключені як <b>${escapeHtml(user.nickname)}</b>. ${ROLE_TEXT[user.role]}\n/stop — відв'язати.`)
        return
      }
    }
    await TelegramChat.updateOne({ chatId }, { $unset: { pendingUserId: 1 }, $set: { awaitingPassword: false } })
    await sendMessage(chatId, 'Вітаю! Це бот Атлеті. Надішліть свій нікнейм з Атлеті.')
    return
  }

  if (chat.userId) {
    await sendMessage(chatId, 'Ви вже підключені. /stop — відв\'язати, /start — статус.')
    return
  }

  if (!chat.awaitingPassword) {
    if (await isLocked(chatId)) {
      // Під блокуванням людина може вводити що завгодно, зокрема пароль.
      await deleteMessage(chatId, msg.message_id)
      await sendMessage(chatId, 'Забагато невдалих спроб. Спробуйте за 15 хвилин.')
      return
    }
    const user = await User.findOne({ nickname: text.replace(/^@/, '').toLowerCase() }, { _id: 1 }).lean()
    await TelegramChat.updateOne({ chatId }, user
      ? { $set: { awaitingPassword: true, pendingUserId: user._id } }
      : { $set: { awaitingPassword: true }, $unset: { pendingUserId: 1 } })
    await sendMessage(chatId, 'Тепер надішліть пароль від Атлеті. Повідомлення з паролем я одразу видалю.')
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
    await sendMessage(chatId, 'Надішліть нікнейм ще раз.')
    return
  }

  const targetUserId = step.pendingUserId ? String(step.pendingUserId) : undefined
  if (await isLocked(chatId, targetUserId)) {
    await sendMessage(chatId, 'Забагато невдалих спроб. Спробуйте за 15 хвилин.')
    return
  }

  // Спроба пишеться ДО bcrypt і знімається при успіху: інакше паралельні спроби
  // в польоті не бачать одна одну в лічильнику isLocked.
  const attempt = await TelegramLoginFail.create({ chatId, targetUserId })

  // passwordHash є в схемі, але не в IUser — той самий міст, що в lib/auth.ts.
  const user = targetUserId
    ? (await User.findById(targetUserId).lean()) as ({ _id: unknown; nickname: string; role: 'coach' | 'client'; passwordHash?: string } | null)
    : null
  // Однакова відповідь і однаковий час для «немає такого» і «не той пароль».
  const ok = await bcrypt.compare(text, user?.passwordHash ?? DUMMY_HASH) && !!user?.passwordHash

  if (!ok || !user) {
    await sendMessage(chatId,
      'Нікнейм або пароль не підходять. Надішліть нікнейм ще раз.\n' +
      'Якщо входите на сайт через Google, спершу задайте пароль у профілі Атлеті.')
    return
  }

  await TelegramLoginFail.deleteOne({ _id: attempt._id })
  await TelegramChat.updateOne({ userId: user._id, chatId: { $ne: chatId } }, { $unset: { userId: 1 } })
  await TelegramChat.updateOne({ chatId }, { $set: { userId: user._id } })
  await sendMessage(chatId, `Готово, <b>${escapeHtml(user.nickname)}</b>! ${ROLE_TEXT[user.role]}\n/stop — відв'язати.`)
}
