import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge } from '@atleti/ui'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function BalancePage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/login')

  await ensureDB()

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

  const sessionsRemaining = balance.sessionsTotal - balance.sessionsUsed
  const transactions = [...(balance.transactions ?? [])].reverse()

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Баланс</h1>

      <GlassCard>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-semibold text-gray-900">{sessionsRemaining}</p>
            <p className="text-xs text-gray-500 mt-0.5">Залишилось</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gray-900">{balance.sessionsTotal}</p>
            <p className="text-xs text-gray-500 mt-0.5">Всього</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gray-900">{balance.sessionsUsed}</p>
            <p className="text-xs text-gray-500 mt-0.5">Використано</p>
          </div>
        </div>
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
                  <Badge variant={tx.type === 'topup' ? 'success' : 'danger'}>
                    {tx.type === 'topup' ? 'Поповнення' : 'Списання'}
                  </Badge>
                  {tx.note && (
                    <p className="text-sm text-gray-500 mt-1">{tx.note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                </div>
                <p className={`text-base font-medium ${tx.type === 'topup' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'topup' ? '+' : '-'}{tx.sessions}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
