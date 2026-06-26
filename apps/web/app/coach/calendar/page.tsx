import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import CalendarClient from './CalendarClient'

export const metadata = { title: 'Календар' }

export default async function CalendarPage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()

  const [relationships, balances, scheduled] = await Promise.all([
    ClientCoach.find({ coachId: user.userId, status: 'active' }).populate('clientId', 'name nickname'),
    Balance.find({ coachId: user.userId }, 'clientId sessionsTotal sessionsUsed'),
    Session.find({ coachId: user.userId, status: 'scheduled' }, 'clientId'),
  ])

  // Залишок для планування = total - used - заплановані (резерв). Збігається з бекенд-перевіркою.
  const balMap = new Map(balances.map((b: any) => [b.clientId.toString(), { total: b.sessionsTotal, used: b.sessionsUsed }]))
  const reservedMap = new Map<string, number>()
  for (const s of scheduled as any[]) {
    const k = s.clientId.toString()
    reservedMap.set(k, (reservedMap.get(k) ?? 0) + 1)
  }

  const clients = relationships.map(r => {
    const c = r.clientId as any
    const id = c._id.toString()
    const b = balMap.get(id) ?? { total: 0, used: 0 }
    const remaining = b.total - b.used - (reservedMap.get(id) ?? 0)
    return { id, name: c.name, nickname: c.nickname, remaining }
  })

  return <CalendarClient clients={clients} />
}
