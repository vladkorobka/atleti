import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()

  const relationships = await ClientCoach.find({ coachId: user.userId, status: 'active' })
    .populate('clientId', 'name nickname')

  const clients = relationships.map(r => {
    const c = r.clientId as any
    return { id: c._id.toString(), name: c.name, nickname: c.nickname }
  })

  return <CalendarClient clients={clients} />
}
