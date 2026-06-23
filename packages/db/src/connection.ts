import mongoose from 'mongoose'

// У serverless (Vercel) модулі переживають теплі інвокації, але конкурентні
// cold-запити можуть викликати connect кілька разів. Кешуємо проміс конекту на
// global, щоб усі інвокації перевикористовували один конект.
declare global {
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | undefined
}

export async function connectDB(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return
  if (!global._mongoosePromise) {
    global._mongoosePromise = mongoose.connect(uri)
  }
  try {
    await global._mongoosePromise
  } catch (err) {
    global._mongoosePromise = undefined // дозволити повтор після невдалого конекту
    throw err
  }
}
