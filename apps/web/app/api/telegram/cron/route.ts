import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { ensureDB } from '@/lib/db'
import { sendCoachDigests, sendClientReminders } from '@/lib/telegram/jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Смикається зовнішнім планувальником (cron-job.org) кожні 5 хв:
// Vercel Hobby дозволяє власний cron лише раз на добу.
export async function GET(req: NextRequest) {
  const want = process.env.CRON_SECRET
  const got = req.headers.get('authorization') ?? ''
  const a = Buffer.from(got), b = Buffer.from(`Bearer ${want}`)
  if (!want || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await ensureDB()
  const now = new Date()
  const [digests, reminders] = await Promise.all([sendCoachDigests(now), sendClientReminders(now)])
  return NextResponse.json({ digests, reminders })
}
