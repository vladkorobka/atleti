// Перевірка перед створенням унікального індексу на заняттях.
//
// Індекс { coachId, clientId, scheduledAt } має бути унікальним, щоб два одночасні
// POST не створили дубль і не списали заняття двічі. Але якщо в базі вже є дублікати,
// createIndex впаде — і деплой разом з ним. Спершу дивимось, що там насправді.
//
// Запуск (з кореня репозиторію):
//   MONGODB_URI="..." node packages/db/scripts/check-session-duplicates.mjs
// Скрипт лише читає — жодних записів у базу не робить.

import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Немає MONGODB_URI. Приклад: MONGODB_URI="mongodb+srv://..." node scripts/check-session-duplicates.mjs')
  process.exit(1)
}

await mongoose.connect(uri)
const sessions = mongoose.connection.collection('sessions')

// Скасовані заняття дублікатами не вважаємо: після скасування той самий слот
// можна зайняти повторно, і саме таку семантику матиме partial-індекс.
const duplicates = await sessions.aggregate([
  { $match: { status: { $in: ['scheduled', 'completed'] } } },
  {
    $group: {
      _id: { coachId: '$coachId', clientId: '$clientId', scheduledAt: '$scheduledAt' },
      count: { $sum: 1 },
      ids: { $push: '$_id' },
      statuses: { $push: '$status' },
    },
  },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } },
]).toArray()

const total = await sessions.countDocuments({ status: { $in: ['scheduled', 'completed'] } })

console.log(`Усього незскасованих занять: ${total}`)
console.log(`Груп-дублікатів: ${duplicates.length}`)

if (duplicates.length === 0) {
  console.log('\nЧисто. Унікальний partial-індекс можна створювати:')
  console.log(`
db.sessions.createIndex(
  { coachId: 1, clientId: 1, scheduledAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['scheduled', 'completed'] } },
    name: 'uniq_coach_client_slot'
  }
)`)
} else {
  console.log('\nІндекс створювати НЕ МОЖНА, доки це не почищено:\n')
  for (const d of duplicates) {
    console.log(`  coach=${d._id.coachId} client=${d._id.clientId} at=${d._id.scheduledAt?.toISOString?.() ?? d._id.scheduledAt}`)
    console.log(`    ${d.count} шт., статуси: ${d.statuses.join(', ')}`)
    console.log(`    _id: ${d.ids.join(', ')}`)
  }
  console.log('\nКожна група — це, найімовірніше, одне реальне заняття, записане двічі.')
  console.log('Видалення зайвого документа НЕ повертає заняття на баланс автоматично —')
  console.log('sessionsUsed доведеться скоригувати вручну на кількість видалених completed.')
}

await mongoose.disconnect()
