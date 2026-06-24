import { z } from 'zod'

export const clientCancelSchema = z.object({
  cancelReason: z.string().max(500).optional(),
})

export const bookingSchema = z.object({
  scheduledAt: z.string().datetime(),
  type: z.enum(['regular', 'split', 'online', 'consultation']),
})
