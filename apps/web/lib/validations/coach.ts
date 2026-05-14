import { z } from 'zod'

const workingHoursDaySchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(15).max(240),
})

const dayKey = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

export const coachProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  specializations: z.array(z.string().max(50)).max(10).optional(),
  cancellationDeadlineHours: z.number().int().min(0).max(168).optional(),
  workingHours: z.record(dayKey, workingHoursDaySchema).optional(),
})

export const inviteSchema = z.object({
  nickname: z.string().min(1).max(50),
})

export const balanceTopupSchema = z.object({
  sessions: z.number().int().min(1).max(1000),
  note: z.string().max(200).optional(),
})

export const sessionCreateSchema = z.object({
  clientId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(15).max(480).optional().default(60),
  type: z.enum(['regular', 'split', 'online', 'consultation']).optional().default('regular'),
})

export const sessionUpdateSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
  cancelReason: z.string().max(500).optional(),
})

export const sessionEditSchema = z.object({
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(15).max(480),
  type: z.enum(['regular', 'split', 'online', 'consultation']),
})

const recurringSchema = z.object({
  type: z.enum(['daily', 'weekly']),
  dayOfWeek: z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const coachBlockSchema = z.object({
  type: z.enum(['time', 'day', 'vacation']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().max(100).optional(),
  recurring: recurringSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'time') {
    if (!data.startTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startTime required', path: ['startTime'] })
    if (!data.endTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endTime required', path: ['endTime'] })
    if (!data.date && !data.recurring) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date or recurring required', path: ['date'] })
  }
  if (data.type === 'day' && !data.date && !data.recurring) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date or recurring required', path: ['date'] })
  }
  if (data.type === 'vacation') {
    if (!data.dateFrom) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateFrom required', path: ['dateFrom'] })
    if (!data.dateTo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateTo required', path: ['dateTo'] })
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateFrom must be before dateTo', path: ['dateFrom'] })
    }
  }
})
