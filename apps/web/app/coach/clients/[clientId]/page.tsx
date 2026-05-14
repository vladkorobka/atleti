import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Avatar, Badge } from '@atleti/ui'
import TopUpButton from './TopUpButton'
import Link from 'next/link'

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()

  const [relationship, balance, sessions] = await Promise.all([
    ClientCoach.findOne({ clientId: params.clientId, coachId: user.userId })
      .populate('clientId', 'name nickname avatar'),
    Balance.findOne({ clientId: params.clientId, coachId: user.userId }),
    Session.find({ clientId: params.clientId, coachId: user.userId })
      .sort({ scheduledAt: -1 })
      .limit(10),
  ])

  if (!relationship) redirect('/coach/clients')

  const client = relationship.clientId as any
  const sessionsRemaining = (balance?.sessionsTotal ?? 0) - (balance?.sessionsUsed ?? 0)

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <Link href="/coach/clients" className="text-gray-500 hover:text-gray-700 text-sm">← Назад</Link>
      </div>

      <GlassCard className="flex items-center gap-4">
        <Avatar name={client.name} src={client.avatar} size="lg" />
        <div>
          <p className="font-semibold text-gray-900">{client.name}</p>
          <p className="text-sm text-gray-500">@{client.nickname}</p>
        </div>
      </GlassCard>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Баланс занять</h2>
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-3xl font-bold text-gray-900">{sessionsRemaining}</p>
              <p className="text-xs text-gray-500">залишилось занять</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Всього: {balance?.sessionsTotal ?? 0}</p>
              <p className="text-sm text-gray-500">Використано: {balance?.sessionsUsed ?? 0}</p>
            </div>
          </div>
          <TopUpButton clientId={params.clientId} />
        </GlassCard>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Останні заняття</h2>
        {sessions.length === 0 ? (
          <GlassCard><p className="text-sm text-gray-400 text-center py-4">Занять ще немає</p></GlassCard>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <GlassCard key={s._id.toString()} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(s.scheduledAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500">{s.duration} хв</p>
                </div>
                <SessionStatusBadge status={s.status} />
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
    scheduled: { label: 'Заплановано', variant: 'warning' },
    completed: { label: 'Проведено', variant: 'success' },
    cancelled: { label: 'Скасовано', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
