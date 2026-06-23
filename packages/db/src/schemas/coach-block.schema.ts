import { Schema } from 'mongoose'

const RecurringSchema = new Schema(
  {
    type: { type: String, enum: ['daily', 'weekly'], required: true },
    dayOfWeek: { type: String, enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
    until: String,
  },
  { _id: false }
)

export const CoachBlockSchema = new Schema({
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['time', 'day', 'vacation'], required: true },
  date: String,
  startTime: String,
  endTime: String,
  dateFrom: String,
  dateTo: String,
  recurring: RecurringSchema,
  label: String,
})

CoachBlockSchema.index({ coachId: 1 })
