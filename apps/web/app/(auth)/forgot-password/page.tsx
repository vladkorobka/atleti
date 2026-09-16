'use client'
import { useState } from 'react'
import { GlassCard, Button, Input } from '@atleti/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Завжди показуємо однаковий результат — не розкриваємо існування акаунта
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-2 text-center">Відновлення паролю</h1>

      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 text-center">
            Якщо акаунт із таким email існує, ми надіслали на нього посилання для скидання паролю. Перевірте пошту.
          </p>
          <a href="/login" className="block text-center text-sm underline text-gray-700">Повернутися до входу</a>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-6 text-center">
            Введіть email — надішлемо посилання для встановлення нового паролю.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" required
            />
            <Button type="submit" loading={loading} fullWidth size="lg">
              {loading ? 'Надсилання...' : 'Надіслати посилання'}
            </Button>
          </form>
          <p className="text-center text-xs text-gray-500 mt-4">
            <a href="/login" className="underline hover:text-gray-700">Повернутися до входу</a>
          </p>
        </>
      )}
    </GlassCard>
  )
}
