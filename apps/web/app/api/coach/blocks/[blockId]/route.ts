import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachBlock } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { blockId: string } }
) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureDB()

  const result = await CoachBlock.deleteOne({
    _id: params.blockId,
    coachId: coachSession.userId,
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
