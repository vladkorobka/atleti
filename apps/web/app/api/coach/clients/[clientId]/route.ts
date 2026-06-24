import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { anamnesisSchema } from '@/lib/validations/coach'

type Params = { params: { clientId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const [relationship, balance] = await Promise.all([
    ClientCoach.findOne({ clientId: params.clientId, coachId: coachSession.userId }).populate('clientId'),
    Balance.findOne({ clientId: params.clientId, coachId: coachSession.userId }),
  ])
  if (!relationship) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({ client: relationship, balance })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = anamnesisSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const relationship = await ClientCoach.findOneAndUpdate(
    { clientId: params.clientId, coachId: coachSession.userId },
    { anamnesis: parsed.data.anamnesis },
    { new: true }
  )
  if (!relationship) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({ anamnesis: relationship.anamnesis })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  await Promise.all([
    ClientCoach.updateOne(
      { clientId: params.clientId, coachId: coachSession.userId },
      { status: 'terminated' }
    ),
    Balance.updateOne(
      { clientId: params.clientId, coachId: coachSession.userId },
      { sessionsTotal: 0, sessionsUsed: 0, transactions: [] }
    ),
  ])

  return NextResponse.json({ ok: true })
}
