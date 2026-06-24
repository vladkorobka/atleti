import { Schema } from 'mongoose'

const TransactionSchema = new Schema(
  {
    type: { type: String, enum: ['topup', 'debit'], required: true },
    sessions: { type: Number, required: true },
    note: String,
    createdAt: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
)

export const BalanceSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionsTotal: { type: Number, default: 0 },
  sessionsUsed: { type: Number, default: 0 },
  transactions: [TransactionSchema],
})

BalanceSchema.index({ clientId: 1, coachId: 1 }, { unique: true })

BalanceSchema.virtual('sessionsRemaining').get(function () {
  return this.sessionsTotal - this.sessionsUsed
})
