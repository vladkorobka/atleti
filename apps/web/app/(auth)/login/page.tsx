'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { GlassCard, Spinner } from '@atleti/ui'
import { Logo } from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Невірний email або пароль')
      setLoading(false)
    } else {
      // Лишаємо loading=true до повного переходу — кнопка не «миготить»
      window.location.href = '/'
    }
  }

  return (
    <GlassCard className="w-full max-w-sm">
      <div className="flex justify-center mb-6">
        <Logo className="h-12" />
      </div>

      {/* Google-вхід тимчасово вимкнено */}

      <form onSubmit={handleCredentials} className="space-y-3">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль" required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors">
          {loading && <Spinner size={16} className="border-white/40 border-t-white" />}
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-500 mt-3">
        <a href="/forgot-password" className="underline hover:text-gray-700">Забули пароль?</a>
      </p>

      <p className="text-center text-xs text-gray-500 mt-4">
        Немає акаунту?{' '}
        <a href="/register" className="underline hover:text-gray-700">Зареєструватись</a>
      </p>
    </GlassCard>
  )
}
