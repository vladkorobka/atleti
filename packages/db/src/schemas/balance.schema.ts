import { Schema } from 'mongoose'
import type { IBalance } from '@atleti/types'

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

export const BalanceSchema = new Schema<IBalance>({
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionsTotal: { type: Number, default: 0 },
  sessionsUsed: { type: Number, default: 0 },
  transactions: [TransactionSchema],
})

BalanceSchema.virtual('sessionsRemaining').get(function () {
  return this.sessionsTotal - this.sessionsUsed
})
