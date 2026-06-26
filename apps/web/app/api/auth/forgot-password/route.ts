import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { ensureDB } from '@/lib/db'
import { User } from '@atleti/db'
import { sendPasswordResetEmail } from '@/lib/email'

const schema = z.object({ email: z.string().email() })

const RESET_TTL_MS = 60 * 60 * 1000 // 1 година

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase()

  await ensureDB()
  const user = await User.findOne({ email })

  // Не розкриваємо, чи існує акаунт — завжди 200
  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    user.set('resetTokenHash', tokenHash)
    user.set('resetTokenExpiresAt', new Date(Date.now() + RESET_TTL_MS))
    await user.save()

    // Базовий URL — з origin запиту (працює локально й на проді), фолбек на NEXTAUTH_URL
    const base = req.nextUrl?.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${base}/reset-password?token=${token}`
    try {
      await sendPasswordResetEmail(user.email, resetUrl)
    } catch (e) {
      console.error('Не вдалося надіслати лист скидання паролю:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
