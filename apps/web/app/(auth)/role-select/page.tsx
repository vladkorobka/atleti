'use client'
import { useState } from 'react'
import { GlassCard, Button, Input } from '@atleti/ui'

export default function RoleSelectPage() {
  const [role, setRole] = useState<'coach' | 'client'>('client')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/role-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, nickname }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    window.location.href = '/'
  }

  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-2 text-center">Завершення реєстрації</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Оберіть роль та введіть нікнейм</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(['client', 'coach'] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`py-3 rounded-md border text-sm font-medium transition-colors ${role === r ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:border-gray-400'}`}>
              {r === 'coach' ? 'Тренер' : 'Клієнт'}
            </button>
          ))}
        </div>
        <Input placeholder="Нікнейм" required value={nickname}
          onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))} />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? 'Збереження...' : 'Продовжити'}
        </Button>
      </form>
    </GlassCard>
  )
}
