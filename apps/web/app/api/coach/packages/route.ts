import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoachSession() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function GET() {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const profile = await CoachProfile.findOne({ userId: user.userId })
  return NextResponse.json({ packages: profile?.packages ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const { name, sessions, price, currency = 'UAH' } = await req.json()
  if (!name || !sessions || !price) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: user.userId },
    { $push: { packages: { name, sessions, price, currency } } },
    { upsert: true, new: true }
  )
  return NextResponse.json({ packages: profile.packages }, { status: 201 })
}
