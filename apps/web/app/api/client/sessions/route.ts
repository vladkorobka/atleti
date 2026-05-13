import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  const query: Record<string, unknown> = { clientId: clientSession.userId }
  if (status) {
    query.status = status
  }

  const sessions = await Session.find(query)
    .populate('coachId', 'name nickname')
    .sort({ scheduledAt: -1 })

  return NextResponse.json({ sessions })
}
