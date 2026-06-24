// Email за інтерфейсом: відправка через Resend (https://resend.com).
// Якщо RESEND_API_KEY не заданий — лог у консоль (dev).
// Env: RESEND_API_KEY, RESEND_FROM

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'Атлеті <onboarding@resend.dev>'

  if (!apiKey) {
    // Resend не налаштований — не падаємо, лише логуємо (dev-режим)
    console.warn(`[email:mock] RESEND_API_KEY не заданий. Лист до ${to}: ${subject}\n${html}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend помилка ${res.status}: ${detail}`)
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
    <p>Ви запросили скидання паролю для Атлеті.</p>
    <p><a href="${resetUrl}">Натисніть тут, щоб встановити новий пароль</a></p>
    <p>Якщо це були не ви — проігноруйте цей лист. Посилання дійсне 1 годину.</p>
  `
  await sendMail(to, 'Скидання паролю — Атлеті', html)
}
