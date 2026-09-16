import { Schema } from 'mongoose'

export const ClientCoachSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'active', 'rejected', 'terminated'], default: 'pending' },
  invitedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  // Анамнез клієнта — приватний запис тренера (історія, травми, цілі тощо)
  anamnesis: { type: String, default: '' },
})

ClientCoachSchema.index({ clientId: 1, coachId: 1 }, { unique: true })
