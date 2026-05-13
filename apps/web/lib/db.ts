import { connectDB } from '@atleti/db'

export async function ensureDB(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  await connectDB(uri)
}
