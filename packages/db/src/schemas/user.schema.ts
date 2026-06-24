import { Schema } from 'mongoose'
import type { IUser } from '@atleti/types'

type UserDocument = IUser & {
  passwordHash?: string
  resetTokenHash?: string
  resetTokenExpiresAt?: Date
}

export const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    avatar: { type: String },
    role: { type: String, enum: ['coach', 'client'], required: true },
    nickname: { type: String, required: true, unique: true, lowercase: true },
    googleId: { type: String, sparse: true },
    passwordHash: { type: String },
    // Скидання паролю: зберігаємо лише sha256-хеш токена + термін дії
    resetTokenHash: { type: String },
    resetTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
)
