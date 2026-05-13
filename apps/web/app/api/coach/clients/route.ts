import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile } from '@atleti/db'
import { getClientLimitMessage } from '@/lib/coach-utils'
import type { AtletiSession } from '@atleti/types'

export async function GET() {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const [relationships, profile] = await Promise.all([
    ClientCoach.find({ coachId: coachSession.userId }).populate('clientId'),
    CoachProfile.findOne({ userId: coachSession.userId }),
  ])

  const activeCount = relationships.filter(r => r.status === 'active').length
  const limitMessage = getClientLimitMessage(activeCount, profile?.clientLimit ?? 10)

  return NextResponse.json({ clients: relationships, limitMessage, plan: profile?.plan ?? 'free' })
}
