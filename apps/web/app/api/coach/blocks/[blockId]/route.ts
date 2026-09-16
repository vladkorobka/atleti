import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachBlock } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { coachBlockSchema } from '@/lib/validations/coach'

const BLOCK_FIELDS = ['type', 'date', 'startTime', 'endTime', 'dateFrom', 'dateTo', 'label', 'recurring'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { blockId: string } }
) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = coachBlockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  await ensureDB()

  // Замінюємо всі поля блоку: присутні — $set, відсутні (напр. при зміні типу) — $unset
  const data = parsed.data as Record<string, unknown>
  const set: Record<string, unknown> = {}
  const unset: Record<string, ''> = {}
  for (const key of BLOCK_FIELDS) {
    if (data[key] !== undefined) set[key] = data[key]
    else unset[key] = ''
  }

  const block = await CoachBlock.findOneAndUpdate(
    { _id: params.blockId, coachId: coachSession.userId },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true }
  )
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ block })
}

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
