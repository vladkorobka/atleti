import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard } from '@atleti/ui'
import Link from 'next/link'
import { settlePastSessions } from '@/lib/settle-sessions'
import { formatKyiv } from '@/lib/tz'

const sessionTypeLabel: Record<string, string> = {
  regular: 'Тренування',
  split: 'Спліт',
  online: 'Онлайн',
  consultation: 'Консультація',
}

function formatDate(date: Date): string {
  return formatKyiv(date, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function CoachDashboard() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/login')

  await ensureDB()
  await settlePastSessions({ coachId: user.userId })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [relationships, monthlySessions, upcomingSessions] = await Promise.all([
    ClientCoach.find({ coachId: user.userId }).populate('clientId', 'name nickname'),
    Session.countDocuments({
      coachId: user.userId,
      scheduledAt: { $gte: monthStart, $lt: monthEnd },
      status: { $ne: 'cancelled' },
    }),
    Session.find({
      coachId: user.userId,
      scheduledAt: { $gte: now },
      status: 'scheduled',
    })
      .populate('clientId', 'name')
      .sort({ scheduledAt: 1 })
      .limit(3),
  ])

  const activeClients = relationships.filter(r => r.status === 'active').length
  const pendingInvites = relationships.filter(r => r.status === 'pending').length
  const nextSession = upcomingSessions[0]
  const clientLimit = 10

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Вітаємо, {user.name}</h1>
        {user.nickname && (
          <p className="text-sm text-gray-500 mt-1">@{user.nickname}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassCard>
          <p className="text-xs text-gray-500 mb-1">Клієнти</p>
          <p className="text-2xl font-bold text-gray-900">
            {activeClients} / {clientLimit}
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-xs text-gray-500 mb-1">Заняття цього місяця</p>
          <p className="text-2xl font-bold text-gray-900">{monthlySessions}</p>
        </GlassCard>

        <GlassCard>
          <p className="text-xs text-gray-500 mb-1">Наступне заняття</p>
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {nextSession ? formatDate(nextSession.scheduledAt as Date) : '—'}
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-xs text-gray-500 mb-1">Очікують підтвердження</p>
          <p className="text-2xl font-bold text-gray-900">{pendingInvites}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { href: '/coach/clients', label: 'Запросити клієнта' },
          { href: '/coach/calendar', label: 'Переглянути календар' },
          { href: '/coach/profile', label: 'Налаштування' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="block h-full">
            <GlassCard className="h-full min-h-[4rem] flex items-center justify-center text-center px-2 py-3 cursor-pointer hover:bg-white/70 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700 leading-tight break-words">{label}</span>
            </GlassCard>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Найближчі заняття</h2>
        {upcomingSessions.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-gray-400 text-center py-4">Заняття не заплановані</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {upcomingSessions.map(s => (
              <GlassCard key={s._id.toString()}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(s.clientId as any).name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(s.scheduledAt as Date)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-600 bg-white/60 border border-white/40 rounded-md px-2 py-1">
                    {sessionTypeLabel[s.type as string] ?? s.type}
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
