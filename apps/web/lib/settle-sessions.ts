import { Session, Balance } from '@atleti/db'

// Лениво «закриває» минулі заплановані заняття: scheduled із scheduledAt<=now → completed,
// та списує одну сесію з балансу. Викликається на кожному читанні дашбордів/списків.
//
// Ідемпотентність: перехід робиться умовним updateOne({status:'scheduled'}), і баланс
// інкрементується лише коли цей виклик реально виграв перехід (modifiedCount===1),
// тож паралельні читання не спишуть двічі.
export async function settlePastSessions(filter: Record<string, unknown> = {}): Promise<void> {
  const now = new Date()
  const due = await Session.find({
    ...filter,
    status: 'scheduled',
    scheduledAt: { $lte: now },
  }).select('_id clientId coachId')

  for (const s of due) {
    const res = await Session.updateOne(
      { _id: s._id, status: 'scheduled' },
      { $set: { status: 'completed' } }
    )
    if (res.modifiedCount === 1) {
      await Balance.updateOne(
        { clientId: s.clientId, coachId: s.coachId },
        { $inc: { sessionsUsed: 1 } }
      )
    }
  }
}
