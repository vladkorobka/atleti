import { z } from 'zod'

export const clientCancelSchema = z.object({
  cancelReason: z.string().max(500).optional(),
})
