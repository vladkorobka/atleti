'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { GlassCard, Select, Button, Input } from '@atleti/ui'

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
        <Input placeholder="Ім'я" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input placeholder="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input placeholder="Пароль (мін. 8 символів)" type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} />
        <Input placeholder="Нікнейм (латиниця, без пробілів)" required value={form.nickname}
          onChange={(e) => set('nickname', e.target.value.toLowerCase().replace(/\s/g, ''))} />
        {form.role === 'client' && (
          <p className="text-xs text-gray-500 -mt-1.5 px-0.5">
            Саме за нікнеймом тренер знайде вас, щоб надіслати запрошення. Оберіть такий, який зможете повідомити своєму тренеру.
          </p>
        )}
        <Select
          value={form.role}
          onChange={(v) => set('role', v)}
          options={[
            { value: 'client', label: 'Я — клієнт' },
            { value: 'coach', label: 'Я — тренер' },
          ]}
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? 'Реєстрація...' : 'Зареєструватись'}
        </Button>
      </form>
      <p className="text-center text-xs text-gray-500 mt-4">
        Вже є акаунт? <a href="/login" className="underline hover:text-gray-700">Увійти</a>
      </p>
    </GlassCard>
  )
}
