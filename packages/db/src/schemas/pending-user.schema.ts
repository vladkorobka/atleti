import { Schema } from 'mongoose'

// Незавершені реєстрації: акаунт у `users` створюється ЛИШЕ після підтвердження email.
// Тут тимчасово зберігаємо дані + sha256-хеш токена підтвердження.
export const PendingUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['coach', 'client'], required: true },
    nickname: { type: String, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)
