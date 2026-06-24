'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { GlassCard, Select } from '@atleti/ui'

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'client', nickname: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    await signIn('credentials', { email: form.email, password: form.password, callbackUrl: '/' })
  }

  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-6 text-center">Реєстрація</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input placeholder="Ім'я" required value={form.name} onChange={(e) => set('name', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
        <input placeholder="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
        <input placeholder="Пароль (мін. 8 символів)" type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
        <input placeholder="Нікнейм (латиниця, без пробілів)" required value={form.nickname}
          onChange={(e) => set('nickname', e.target.value.toLowerCase().replace(/\s/g, ''))}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
        <Select
          value={form.role}
          onChange={(v) => set('role', v)}
          options={[
            { value: 'client', label: 'Я — клієнт' },
            { value: 'coach', label: 'Я — тренер' },
          ]}
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {loading ? 'Реєстрація...' : 'Зареєструватись'}
        </button>
      </form>
      <p className="text-center text-xs text-gray-500 mt-4">
        Вже є акаунт? <a href="/login" className="underline hover:text-gray-700">Увійти</a>
      </p>
    </GlassCard>
  )
}
