import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile, User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoachUser() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function GET() {
  const user = await getCoachUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const profile = await CoachProfile.findOne({ userId: dbUser._id })
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest) {
  const user = await getCoachUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const body = await req.json()
  const { bio, specializations, cancellationDeadlineHours, workingHours } = body
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: dbUser._id },
    { bio, specializations, cancellationDeadlineHours, workingHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({ profile })
}
