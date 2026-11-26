import mongoose, { type Model } from 'mongoose'
import type {
  IUser, ICoachProfile, IClientCoach, IBalance, ISession, IMessage, IContent, ICoachBlock, IPendingUser,
} from '@atleti/types'
import { UserSchema } from '../schemas/user.schema'
import { PendingUserSchema } from '../schemas/pending-user.schema'
import { CoachProfileSchema } from '../schemas/coach-profile.schema'
import { ClientCoachSchema } from '../schemas/client-coach.schema'
import { BalanceSchema } from '../schemas/balance.schema'
import { SessionSchema } from '../schemas/session.schema'
import { MessageSchema } from '../schemas/message.schema'
import { ContentSchema } from '../schemas/content.schema'
import { CoachBlockSchema } from '../schemas/coach-block.schema'
import { TelegramChatSchema, TelegramSentSchema, TelegramLoginFailSchema } from '../schemas/telegram.schema'

// Схеми зберігають ID як ObjectId, а інтерфейси @atleti/types оголошують їх string
// (ObjectId серіалізується у string для застосунку). Типізуємо моделі через інтерфейс —
// це навмисний міст між представленням у БД і в коді.
export const User = (mongoose.models.User ?? mongoose.model('User', UserSchema)) as unknown as Model<IUser>
export const CoachProfile = (mongoose.models.CoachProfile ?? mongoose.model('CoachProfile', CoachProfileSchema)) as unknown as Model<ICoachProfile>
export const ClientCoach = (mongoose.models.ClientCoach ?? mongoose.model('ClientCoach', ClientCoachSchema)) as unknown as Model<IClientCoach>
export const Balance = (mongoose.models.Balance ?? mongoose.model('Balance', BalanceSchema)) as unknown as Model<IBalance>
export const Session = (mongoose.models.Session ?? mongoose.model('Session', SessionSchema)) as unknown as Model<ISession>
export const Message = (mongoose.models.Message ?? mongoose.model('Message', MessageSchema)) as unknown as Model<IMessage>
export const Content = (mongoose.models.Content ?? mongoose.model('Content', ContentSchema)) as unknown as Model<IContent>
export const CoachBlock = (mongoose.models.CoachBlock ?? mongoose.model('CoachBlock', CoachBlockSchema)) as unknown as Model<ICoachBlock>
export const PendingUser = (mongoose.models.PendingUser ?? mongoose.model('PendingUser', PendingUserSchema)) as unknown as Model<IPendingUser>
export interface ITelegramChat {
  _id: string
  chatId: number
  userId?: string
  awaitingPassword: boolean
  pendingUserId?: string
}
export const TelegramChat = (mongoose.models.TelegramChat ?? mongoose.model('TelegramChat', TelegramChatSchema)) as unknown as Model<ITelegramChat>
export const TelegramSent = (mongoose.models.TelegramSent ?? mongoose.model('TelegramSent', TelegramSentSchema)) as unknown as Model<{ key: string; createdAt: Date }>
export const TelegramLoginFail = (mongoose.models.TelegramLoginFail ?? mongoose.model('TelegramLoginFail', TelegramLoginFailSchema)) as unknown as Model<{ chatId: number; targetUserId?: string; createdAt: Date }>
