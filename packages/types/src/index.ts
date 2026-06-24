export type UserRole = 'coach' | 'client'

export type SessionType = 'regular' | 'split' | 'online' | 'consultation'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type ClientCoachStatus = 'pending' | 'active' | 'rejected' | 'terminated'
export type TransactionType = 'topup' | 'debit'
export type ContentType = 'video' | 'file'
export type AttachmentType = 'video' | 'file' | 'image'
export type CoachPlan = 'free' | 'pro'

export interface IUser {
  _id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  nickname: string
  googleId?: string
  createdAt: Date
  updatedAt: Date
}

export interface IWorkingHoursDay {
  start: string   // "09:00"
  end: string     // "18:00"
  slotDuration: number // хвилини
}

export interface ICoachProfile {
  _id: string
  userId: string
  bio?: string
  specializations: string[]
  workingHours: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', IWorkingHoursDay>>
  cancellationDeadlineHours: number
  plan: CoachPlan
  clientLimit: number
}

export interface IClientCoach {
  _id: string
  clientId: string
  coachId: string
  status: ClientCoachStatus
  invitedAt: Date
  acceptedAt?: Date
  anamnesis?: string
}

export interface ITransaction {
  type: TransactionType
  sessions: number
  note?: string
  createdAt: Date
  recordedBy: string
}

export interface IBalance {
  _id: string
  clientId: string
  coachId: string
  sessionsTotal: number
  sessionsUsed: number
  sessionsRemaining: number
  transactions: ITransaction[]
}

export interface ISession {
  _id: string
  clientId: string
  coachId: string
  scheduledAt: Date
  duration: number
  type: SessionType
  status: SessionStatus
  cancelledBy?: string
  cancelledByRole?: UserRole
  cancelReason?: string
  createdBy: UserRole
}

export interface IAttachment {
  type: AttachmentType
  url: string
  filename: string
  size: number
}

export interface IMessage {
  _id: string
  threadId: string
  senderId: string
  text?: string
  attachments?: IAttachment[]
  createdAt: Date
  readAt?: Date
}

export interface IContent {
  _id: string
  coachId: string
  targetType: 'all' | 'client'
  targetId?: string
  title: string
  description?: string
  type: ContentType
  cloudflareVideoId?: string
  fileUrl?: string
  createdAt: Date
}

// NextAuth session extension
export interface AtletiSession {
  userId: string
  role: UserRole
  nickname: string
  name: string
  email: string
  avatar?: string
}

export type DowKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type CoachBlockType = 'time' | 'day' | 'vacation'
export type RecurringType = 'daily' | 'weekly'

export interface ICoachBlockRecurring {
  type: RecurringType
  dayOfWeek?: DowKey
  until?: string  // "2026-12-31"
}

export interface ICoachBlock {
  _id: string
  coachId: string
  type: CoachBlockType
  date?: string        // "2026-05-14" — for type='time' | 'day'
  startTime?: string   // "12:00" — for type='time'
  endTime?: string     // "13:00" — for type='time'
  dateFrom?: string    // "2026-07-01" — for type='vacation'
  dateTo?: string      // "2026-07-14" — for type='vacation'
  recurring?: ICoachBlockRecurring
  label?: string
}
