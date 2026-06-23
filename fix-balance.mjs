import mongoose from 'mongoose'

await mongoose.connect('mongodb://localhost:27017/atleti')
const clientId = new mongoose.Types.ObjectId('6a05bd3a6bc0fc6e0c62fac6')
await mongoose.connection.db.collection('balances').updateOne(
  { clientId },
  { $set: { sessionsUsed: 2 } }
)
const b = await mongoose.connection.db.collection('balances').findOne({ clientId })
console.log('Fixed:', { total: b.sessionsTotal, used: b.sessionsUsed, remaining: b.sessionsTotal - b.sessionsUsed })
await mongoose.disconnect()
