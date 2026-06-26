import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile, User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { GlassCard } from '@atleti/ui'
import { LeaveCoachButton } from './LeaveCoachButton'

export const metadata = { title: 'Тренер' }

export default async function CoachPage() {
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Тренер</h1>
        <GlassCard>
          <p className="text-sm text-gray-400">Немає активного тренера</p>
        </GlassCard>
      </div>
    )
  }

  const [coachUser, coachProfile] = await Promise.all([
    User.findById(relationship.coachId, 'name nickname'),
    CoachProfile.findOne({ userId: relationship.coachId }),
  ])

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Тренер</h1>

      <GlassCard>
        <h2 className="text-xl font-semibold text-gray-900">{coachUser?.name}</h2>
        {coachUser?.nickname && (
          <p className="text-sm text-gray-500 mt-0.5">@{coachUser.nickname}</p>
        )}

        {coachProfile?.bio && (
          <p className="text-sm text-gray-700 mt-3">{coachProfile.bio}</p>
        )}

        {coachProfile?.specializations && coachProfile.specializations.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Спеціалізації</p>
            <div className="flex flex-wrap gap-1.5">
              {coachProfile.specializations.map((s: string) => (
                <span
                  key={s}
                  className="text-xs bg-gray-100 text-gray-700 rounded-md px-2 py-0.5"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {coachProfile?.cancellationDeadlineHours != null && (
          <p className="text-sm text-gray-500 mt-3">
            Скасування заняття: не пізніше ніж за {coachProfile.cancellationDeadlineHours} год
          </p>
        )}
      </GlassCard>

      <div className="pt-2">
        <LeaveCoachButton />
      </div>
    </div>
  )
}
