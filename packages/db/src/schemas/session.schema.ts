import { Schema } from 'mongoose'
import type { ISession } from '@atleti/types'

export const SessionSchema = new Schema<ISession>({
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, required: true, default: 60 },
  type: { type: String, enum: ['regular', 'split', 'online', 'consultation'], default: 'regular' },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledByRole: { type: String, enum: ['coach', 'client'] },
  cancelReason: String,
  createdBy: { type: String, enum: ['coach', 'client'], required: true },
})

SessionSchema.index({ coachId: 1, scheduledAt: 1 })
