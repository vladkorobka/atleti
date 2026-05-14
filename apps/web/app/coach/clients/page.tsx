import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Avatar, Badge } from '@atleti/ui'
import InviteButton from './InviteButton'
import Link from 'next/link'

export default async function ClientsPage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()

  const [relationships, profile] = await Promise.all([
    ClientCoach.find({ coachId: user.userId })
      .populate('clientId', 'name nickname avatar')
      .sort({ invitedAt: -1 }),
    CoachProfile.findOne({ userId: user.userId }),
  ])

  const activeCount = relationships.filter((r: any) => r.status === 'active').length
  const clientLimit = profile?.clientLimit ?? 10
  const canInvite = activeCount < clientLimit

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Клієнти</h1>
        <span className="text-sm text-gray-500">{activeCount} / {clientLimit}</span>
      </div>

      <InviteButton canInvite={canInvite} />

      {relationships.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-gray-400 text-center py-6">
            У вас поки немає клієнтів. Запросіть клієнта по нікнейму.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel: any) => {
            const client = rel.clientId as any
            return (
              <Link key={rel._id.toString()} href={`/coach/clients/${client._id}`}>
                <GlassCard className="flex items-center gap-3">
                  <Avatar name={client.name} src={client.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{client.name}</p>
                    <p className="text-xs text-gray-500">@{client.nickname}</p>
                  </div>
                  <StatusBadge status={rel.status} />
                </GlassCard>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
    active: { label: 'Активний', variant: 'success' },
    pending: { label: 'Очікує', variant: 'warning' },
    rejected: { label: 'Відхилено', variant: 'danger' },
    terminated: { label: 'Завершено', variant: 'default' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
