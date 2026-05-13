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

export async function PUT(req: NextRequest, { params }: { params: { packageId: string } }) {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const { name, sessions, price, currency } = await req.json()
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: user.userId, 'packages._id': params.packageId },
    { $set: { 'packages.$': { _id: params.packageId, name, sessions, price, currency } } },
    { new: true }
  )
  if (!profile) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  return NextResponse.json({ packages: profile.packages })
}

export async function DELETE(_req: NextRequest, { params }: { params: { packageId: string } }) {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: user.userId },
    { $pull: { packages: { _id: params.packageId } } },
    { new: true }
  )
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ packages: profile.packages })
}
