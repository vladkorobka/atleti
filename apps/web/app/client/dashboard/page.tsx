import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge, WalletIcon, UserIcon } from '@atleti/ui'
import Link from 'next/link'
import { AcceptInviteButton } from '../coach/AcceptInviteButton'
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

export const metadata = { title: 'Головна' }

export default async function ClientDashboard() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/login')

  await ensureDB()
  await settlePastSessions({ clientId: user.userId })

  const relationship = await ClientCoach.findOne({
    clientId: user.userId,
    status: { $in: ['pending', 'active'] },
  }).populate('coachId', 'name nickname')

  const status = relationship?.status ?? 'none'
  // coachId спопульований у обʼєкт на рантаймі, хоч статичний тип — string
  const coach = relationship?.coachId as unknown as { name: string; nickname: string } | null

  let balance = null
  let nextSession = null
  let reserved = 0

  if (status === 'active' && relationship) {
    const coachId = (relationship.coachId as unknown as { _id?: string })._id ?? relationship.coachId
    ;[balance, nextSession, reserved] = await Promise.all([
      Balance.findOne({ clientId: user.userId, coachId }),
      Session.findOne({
        clientId: user.userId,
        status: 'scheduled',
      }).sort({ scheduledAt: 1 }),
      Session.countDocuments({ clientId: user.userId, coachId, status: 'scheduled' }),
    ])
  }

  const available = balance ? Math.max(0, balance.sessionsTotal - balance.sessionsUsed - reserved) : 0

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Вітаємо, {user.name}</h1>

      {status === 'none' && (
        <GlassCard>
          <p className="text-sm text-gray-500 mb-1">Статус</p>
          <p className="text-sm text-gray-400">
            Зверніться до тренера для отримання запрошення. Ваш нікнейм:{' '}
            <strong className="text-gray-700">@{user.nickname}</strong>
          </p>
        </GlassCard>
      )}

      {status === 'pending' && coach && (
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Статус</p>
            <Badge variant="warning">Очікування підтвердження</Badge>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Тренер {coach.name} надіслав вам запрошення
          </p>
          <AcceptInviteButton />
        </GlassCard>
      )}

      {status === 'active' && (
        <>
          {balance ? (
            <GlassCard>
              <p className="text-sm text-gray-500 mb-1">Доступно для бронювання</p>
              <p className={`text-3xl font-semibold ${available === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                {available}
                <span className="text-base font-normal text-gray-400"> / {balance.sessionsTotal}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Заплановано: <span className="font-medium text-amber-600">{reserved}</span>
                {'  ·  '}Проведено: <span className="font-medium text-gray-700">{balance.sessionsUsed}</span>
              </p>
            </GlassCard>
          ) : (
            <GlassCard>
              <p className="text-sm text-gray-400">Тренер ще не встановив баланс занять</p>
            </GlassCard>
          )}

          {nextSession && (
            <GlassCard>
              <p className="text-sm text-gray-500 mb-1">Наступне заняття</p>
              <p className="text-base font-medium text-gray-900">
                {formatDate(nextSession.scheduledAt)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {sessionTypeLabel[nextSession.type] ?? nextSession.type}
              </p>
            </GlassCard>
          )}

          {!nextSession && (
            <GlassCard>
              <p className="text-sm text-gray-400">Немає запланованих занять</p>
            </GlassCard>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/client/balance"
              className="flex items-center justify-center gap-1.5 bg-gray-900 text-white rounded-md px-4 py-2.5 text-sm font-medium text-center shadow-sm hover:bg-gray-800 transition-colors"
            >
              <WalletIcon className="h-4 w-4" />
              Баланс
            </Link>
            <Link
              href="/client/coach"
              className="flex items-center justify-center gap-1.5 bg-white/60 backdrop-blur-sm border border-white/40 text-gray-900 rounded-md px-4 py-2.5 text-sm font-medium text-center shadow-sm hover:bg-white/80 transition-colors"
            >
              <UserIcon className="h-4 w-4" />
              Тренер
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
