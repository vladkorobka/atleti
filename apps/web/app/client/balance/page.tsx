import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge } from '@atleti/ui'
import { settlePastSessions } from '@/lib/settle-sessions'
import { sessionsAvailable, sessionsDebt, pluralSessions } from '@/lib/balance'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const metadata = { title: 'Баланс' }

export default async function BalancePage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/login')

  await ensureDB()
  await settlePastSessions({ clientId: user.userId })

  const relationship = await ClientCoach.findOne({
    clientId: user.userId,
    status: 'active',
  })

  if (!relationship) {
    return (
      <div className="pt-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Баланс</h1>
        <GlassCard>
          <p className="text-sm text-gray-400">Немає активного балансу</p>
        </GlassCard>
      </div>
    )
  }

  const balance = await Balance.findOne({
    clientId: user.userId,
    coachId: relationship.coachId,
  })

  if (!balance) {
    return (
      <div className="pt-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Баланс</h1>
        <GlassCard>
          <p className="text-sm text-gray-400">Немає активного балансу</p>
        </GlassCard>
      </div>
    )
  }

  const reserved = await Session.countDocuments({
    clientId: user.userId,
    coachId: relationship.coachId,
    status: 'scheduled',
  })
  const available = sessionsAvailable(balance, reserved)
  const debt = sessionsDebt(balance)
  const transactions = [...(balance.transactions ?? [])].reverse()

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Баланс</h1>

      <GlassCard>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className={`text-2xl font-semibold ${available === 0 ? 'text-red-500' : 'text-gray-900'}`}>{available}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Доступно</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-600">{reserved}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Заплановано</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{balance.sessionsUsed}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Проведено</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-400">{balance.sessionsTotal}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Всього</p>
          </div>
        </div>
        {debt > 0 && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            Заборговано: {debt} {pluralSessions(debt)}. Проведених занять більше,
            ніж оплачених — поповніть баланс, щоб бронювати далі.
          </p>
        )}
      </GlassCard>

      <h2 className="text-lg font-medium text-gray-900">Транзакції</h2>

      {transactions.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-gray-400">Транзакцій немає</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <GlassCard key={i}>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant={tx.type === 'debit' ? 'danger' : 'success'}>
                    {tx.type === 'topup' ? 'Поповнення' : tx.type === 'refund' ? 'Повернення' : 'Списання'}
                  </Badge>
                  {tx.note && (
                    <p className="text-sm text-gray-500 mt-1">{tx.note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                </div>
                <p className={`text-base font-medium ${tx.type === 'debit' ? 'text-red-500' : 'text-green-600'}`}>
                  {tx.type === 'debit' ? '-' : '+'}{tx.sessions}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
