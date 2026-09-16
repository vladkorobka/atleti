import { Schema } from 'mongoose'

export const SessionSchema = new Schema({
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

// Один клієнт не може мати два заняття в один момент. Перевірка збігів у роуті —
// це read-then-write, тож два одночасні POST (ретрай мережі, дві вкладки) обходили
// б її і створювали дубль із подвійним списанням балансу. Індекс закриває гонку на
// рівні БД. Скасовані заняття виключені: після скасування слот можна зайняти знову.
// Спліт лишається можливим — це заняття РІЗНИХ клієнтів у той самий час.
SessionSchema.index(
  { coachId: 1, clientId: 1, scheduledAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['scheduled', 'completed'] } },
    name: 'uniq_coach_client_slot',
  }
)
