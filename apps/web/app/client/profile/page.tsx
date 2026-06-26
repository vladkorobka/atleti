'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { GlassCard, CenteredSpinner, Button, Input } from '@atleti/ui'

export default function ProfilePage() {
  const { update } = useSession()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [isGoogle, setIsGoogle] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        setName(data.name ?? '')
        setEmail(data.email ?? '')
        setNickname(data.nickname ?? '')
        setIsGoogle(!!data.isGoogle)
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body: Record<string, string> = { name, email, nickname }
    if (newPassword) {
      body.currentPassword = currentPassword
      body.newPassword = newPassword
    }

    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Помилка збереження')
      setSaving(false)
      return
    }

    await update()
    setCurrentPassword('')
    setNewPassword('')
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <CenteredSpinner />

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Профіль</h1>

      <GlassCard>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Ім'я"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={100}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <Input
            label="Нікнейм"
            value={nickname}
            onChange={e => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9._]+"
            leftIcon={<span className="text-sm">@</span>}
          />

          {!isGoogle && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Змінити пароль</p>
              <Input
                label="Поточний пароль"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                label="Новий пароль"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button type="submit" loading={saving} fullWidth size="lg">
            {saving ? 'Збереження...' : saved ? 'Збережено' : 'Зберегти'}
          </Button>
        </form>
      </GlassCard>
    </div>
  )
}
