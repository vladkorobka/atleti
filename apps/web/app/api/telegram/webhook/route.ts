import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { ensureDB } from '@/lib/db'
import { handleUpdate, type TgUpdate } from '@/lib/telegram/bot'

export const dynamic = 'force-dynamic'

function secretOk(got: string | null): boolean {
  const want = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!want || !got) return false
  const a = Buffer.from(got), b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await ensureDB()
    await handleUpdate((await req.json()) as TgUpdate)
  } catch (e) {
    // 200 навіть на помилці: інакше Telegram повторюватиме той самий апдейт
    // і заблокує чергу всіх наступних повідомлень цього бота.
    console.error('[telegram] webhook', e)
  }
  return NextResponse.json({ ok: true })
}
