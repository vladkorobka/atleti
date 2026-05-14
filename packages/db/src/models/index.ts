import mongoose from 'mongoose'
import { UserSchema } from '../schemas/user.schema'
import { CoachProfileSchema } from '../schemas/coach-profile.schema'
import { ClientCoachSchema } from '../schemas/client-coach.schema'
import { BalanceSchema } from '../schemas/balance.schema'
import { SessionSchema } from '../schemas/session.schema'
import { MessageSchema } from '../schemas/message.schema'
import { ContentSchema } from '../schemas/content.schema'
import { CoachBlockSchema } from '../schemas/coach-block.schema'

export const User = mongoose.models.User ?? mongoose.model('User', UserSchema)
export const CoachProfile = mongoose.models.CoachProfile ?? mongoose.model('CoachProfile', CoachProfileSchema)
export const ClientCoach = mongoose.models.ClientCoach ?? mongoose.model('ClientCoach', ClientCoachSchema)
export const Balance = mongoose.models.Balance ?? mongoose.model('Balance', BalanceSchema)
export const Session = mongoose.models.Session ?? mongoose.model('Session', SessionSchema)
export const Message = mongoose.models.Message ?? mongoose.model('Message', MessageSchema)
export const Content = mongoose.models.Content ?? mongoose.model('Content', ContentSchema)
export const CoachBlock = mongoose.models.CoachBlock ?? mongoose.model('CoachBlock', CoachBlockSchema)
