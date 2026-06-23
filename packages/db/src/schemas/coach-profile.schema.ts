import { Schema } from 'mongoose'

const WorkingHoursDaySchema = new Schema(
  { start: String, end: String, slotDuration: Number },
  { _id: false }
)

export const CoachProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: String,
  specializations: [String],
  workingHours: {
    mon: WorkingHoursDaySchema, tue: WorkingHoursDaySchema, wed: WorkingHoursDaySchema,
    thu: WorkingHoursDaySchema, fri: WorkingHoursDaySchema, sat: WorkingHoursDaySchema,
    sun: WorkingHoursDaySchema,
  },
  cancellationDeadlineHours: { type: Number, default: 24 },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  clientLimit: { type: Number, default: 10 },
})
