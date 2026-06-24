'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard, Spinner } from '@atleti/ui'

function ResetForm() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Пароль має містити щонайменше 8 символів'); return }
    if (password !== confirm) { setError('Паролі не збігаються'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Помилка скидання паролю')
      }
    } catch {
      setError('Помилка скидання паролю')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 text-center">Пароль змінено. Тепер можна увійти.</p>
        <a href="/login" className="block text-center bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">
          Увійти
        </a>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-500 text-center">Відсутній або недійсний токен. Запросіть скидання ще раз.</p>
        <a href="/forgot-password" className="block text-center text-sm underline text-gray-700">До відновлення паролю</a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Новий пароль" required
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      <input
        type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        placeholder="Повторіть пароль" required
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {loading ? 'Збереження...' : 'Встановити пароль'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-6 text-center">Новий пароль</h1>
      <Suspense fallback={<div className="flex justify-center py-3"><Spinner size={22} /></div>}>
        <ResetForm />
      </Suspense>
    </GlassCard>
  )
}
