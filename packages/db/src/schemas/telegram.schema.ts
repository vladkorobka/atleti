import { Schema } from 'mongoose'

// Розмова бота з одним чатом Telegram. `userId` з'являється лише після перевірки
// пароля. Між кроками тримаємо id знайденого акаунта, а не введений текст: якщо
// людина першим надішле пароль замість нікнейма, він не осяде в БД.
export const TelegramChatSchema = new Schema(
  {
    chatId: { type: Number, required: true, unique: true },
    // Один акаунт Атлеті = один чат: прив'язка з нового чату знімає стару.
    userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    awaitingPassword: { type: Boolean, default: false },
    pendingUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    // Перемикачі з кнопок: клієнт — нагадування, тренер — ранковий дайджест.
    remindersOn: { type: Boolean, default: true },
    digestOn: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Кожна невдала спроба — окремий документ: вставка атомарна, тож паралельні
// вебхуки не з'їдають інкременти, а ліміт рахується і на чат, і на акаунт
// (кілька Telegram-акаунтів не множать спроби на один пароль).
export const TelegramLoginFailSchema = new Schema({
  chatId: { type: Number, required: true, index: true },
  targetUserId: { type: Schema.Types.ObjectId, index: true },
  createdAt: { type: Date, default: Date.now, expires: 15 * 60 },
})

// Журнал уже відправлених розсилок. Cron ходить кожні 5 хв і може перекриватися
// (ретрай зовнішнього планувальника), тож «відправити рівно раз» тримає унікальний
// ключ: вставка-перед-відправкою, дубль ловиться E11000.
export const TelegramSentSchema = new Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
})
