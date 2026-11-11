import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Avatar, Badge } from '@atleti/ui'
import TopUpButton from './TopUpButton'
import AnamnesisCard from './AnamnesisCard'
import RemoveClientButton from './RemoveClientButton'
import Link from 'next/link'
import { settlePastSessions } from '@/lib/settle-sessions'
import { formatKyiv, kyivParts } from '@/lib/tz'
import { pluralSessions } from '@/lib/balance'

export const metadata = { title: 'Клієнт' }

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()
  await settlePastSessions({ coachId: user.userId, clientId: params.clientId })

  const [relationship, balance, sessions] = await Promise.all([
    ClientCoach.findOne({ clientId: params.clientId, coachId: user.userId })
      .populate('clientId', 'name nickname avatar'),
    Balance.findOne({ clientId: params.clientId, coachId: user.userId }),
    // Уся історія, без ліміту: тренер звіряє з нею борги й оплати за будь-який місяць.
    Session.find({ clientId: params.clientId, coachId: user.userId })
      .select('scheduledAt duration status onDebt')
      .sort({ scheduledAt: -1 })
      .lean(),
  ])

  if (!relationship) redirect('/coach/clients')

  const client = relationship.clientId as any
  const sessionsRemaining = (balance?.sessionsTotal ?? 0) - (balance?.sessionsUsed ?? 0)
  const scheduledCount = sessions.filter((s: any) => s.status === 'scheduled').length
  const months = groupByKyivMonth(sessions as any[])

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
              <p className={`text-3xl font-bold ${sessionsRemaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {sessionsRemaining}
              </p>
              <p className="text-xs text-gray-500">
                {sessionsRemaining < 0
                  ? `борг: ${-sessionsRemaining} ${pluralSessions(-sessionsRemaining)}`
                  : 'залишилось занять'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Всього: {balance?.sessionsTotal ?? 0}</p>
              <p className="text-sm text-gray-500">Використано: {balance?.sessionsUsed ?? 0}</p>
              {scheduledCount > 0 && (
                <p className="text-sm text-gray-500">Заплановано: {scheduledCount}</p>
              )}
            </div>
          </div>
          <TopUpButton clientId={params.clientId} />
        </GlassCard>
      </div>

      <AnamnesisCard clientId={params.clientId} initialAnamnesis={relationship.anamnesis ?? ''} />

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Історія занять</h2>
        {sessions.length === 0 ? (
          <GlassCard><p className="text-sm text-gray-400 text-center py-4">Занять ще немає</p></GlassCard>
        ) : (
          <div className="space-y-3">
            {/* Найновіший місяць розгорнутий, решта згорнуті: повна історія за роки
                інакше перетворилась би на нескінченну стрічку. */}
            {months.map((m, i) => (
              <details key={m.key} open={i === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium text-gray-700">
                  <span>{m.label}</span>
                  <span className="text-xs text-gray-400">
                    {m.sessions.length} {pluralSessions(m.sessions.length)}
                    <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
                  </span>
                </summary>
                <div className="mt-1 space-y-2">
                  {m.sessions.map((s: any) => (
                    <GlassCard key={s._id.toString()} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatKyiv(s.scheduledAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500">{s.duration} хв</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {s.onDebt && s.status !== 'cancelled' && <Badge variant="danger">Записано в борг</Badge>}
                        <SessionStatusBadge status={s.status} />
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {relationship.status === 'active' && (
        <div className="pt-2">
          <RemoveClientButton clientId={params.clientId} clientName={client.name} />
        </div>
      )}
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

const MONTHS_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]

// Межі місяця — київські: заняття о 00:30 першого числа за Києвом у UTC ще в
// попередньому місяці, і групування за UTC відносило б його не туди.
// Вхід уже відсортований за спаданням, тож порядок груп і всередині них зберігається.
function groupByKyivMonth<T extends { scheduledAt: Date }>(sessions: T[]) {
  const groups: { key: string; label: string; sessions: T[] }[] = []
  for (const s of sessions) {
    const { year, month } = kyivParts(new Date(s.scheduledAt))
    const key = `${year}-${month}`
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, label: `${MONTHS_UK[month - 1]} ${year}`, sessions: [] }
      groups.push(g)
    }
    g.sessions.push(s)
  }
  return groups
}
