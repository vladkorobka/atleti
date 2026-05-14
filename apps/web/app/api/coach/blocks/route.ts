import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachBlock } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { coachBlockSchema } from '@/lib/validations/coach'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  }

  await ensureDB()

  const [year, m] = month.split('-').map(Number)
  const monthStart = `${year}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(year, m, 0).getDate()
  const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const blocks = await CoachBlock.find({
    coachId: coachSession.userId,
    $or: [
      { date: { $gte: monthStart, $lte: monthEnd } },
      { type: 'vacation', dateFrom: { $lte: monthEnd }, dateTo: { $gte: monthStart } },
      { recurring: { $exists: true } },
    ],
  })

  return NextResponse.json({ blocks })
}

export async function POST(req: NextRequest) {
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

  const block = await CoachBlock.create({
    coachId: coachSession.userId,
    ...parsed.data,
  })

  return NextResponse.json({ block }, { status: 201 })
}
