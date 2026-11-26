// Тонка обгортка над Bot API: бібліотека не потрібна, бо бот лише відповідає
// текстом і видаляє повідомлення з паролем.
async function call(method: string, body: Record<string, unknown>): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`[telegram] ${method} ${res.status}: ${await res.text()}`)
  return res.ok
}

export function sendMessage(chatId: number, html: string, replyMarkup?: unknown): Promise<boolean> {
  return call('sendMessage', {
    chat_id: chatId, text: html, parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export function deleteMessage(chatId: number, messageId: number): Promise<boolean> {
  return call('deleteMessage', { chat_id: chatId, message_id: messageId })
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name
