'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { GlassCard, CenteredSpinner, Button, Input } from '@atleti/ui'

export default function ProfilePage() {
  const { update } = useSession()

  // Account fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [isGoogle, setIsGoogle] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [savedAccount, setSavedAccount] = useState(false)
  const [accountError, setAccountError] = useState('')

  // Coach profile fields
  const [bio, setBio] = useState('')
  const [specializations, setSpecializations] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/user/profile').then(r => r.json()),
      fetch('/api/coach/profile').then(r => r.json()),
    ]).then(([userData, coachData]) => {
      setName(userData.name ?? '')
      setEmail(userData.email ?? '')
      setNickname(userData.nickname ?? '')
      setIsGoogle(!!userData.isGoogle)

      if (coachData.profile) {
        setBio(coachData.profile.bio ?? '')
        setSpecializations((coachData.profile.specializations ?? []).join(', '))
        setDeadlineHours(String(coachData.profile.cancellationDeadlineHours ?? 24))
      }
      setLoading(false)
    })
  }, [])

  async function handleAccountSave(e: React.FormEvent) {
    e.preventDefault()
    setSavingAccount(true)
    setAccountError('')

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
      setAccountError(data.error ?? 'Помилка збереження')
      setSavingAccount(false)
      return
    }

    await update()
    setCurrentPassword('')
    setNewPassword('')
    setSavedAccount(true)
    setSavingAccount(false)
    setTimeout(() => setSavedAccount(false), 2000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/coach/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: bio.trim(),
        specializations: specializations.split(',').map(s => s.trim()).filter(Boolean),
        cancellationDeadlineHours: Math.min(168, Math.max(0, Number(deadlineHours) || 0)),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error?.bio?.[0] ?? 'Помилка збереження'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <CenteredSpinner />

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-xl font-semibold text-gray-900">Профіль тренера</h1>

      {/* Account section */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Акаунт</h2>
        <form onSubmit={handleAccountSave} className="space-y-4">
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

          {accountError && <p className="text-xs text-red-500">{accountError}</p>}

          <Button type="submit" loading={savingAccount} fullWidth size="lg">
            {savingAccount ? 'Збереження...' : savedAccount ? 'Збережено' : 'Зберегти акаунт'}
          </Button>
        </form>
      </GlassCard>

      {/* Coach profile section */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Профіль тренера</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Про себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Розкажіть про свій досвід та підхід до тренувань..."
              className="w-full resize-none rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-sm placeholder:text-gray-400 transition-colors focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400/60"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/1000</p>
          </div>

          <div>
            <Input
              label="Спеціалізації"
              value={specializations}
              onChange={e => setSpecializations(e.target.value)}
              placeholder="фітнес, реабілітація, схуднення (через кому)"
            />
            <p className="text-xs text-gray-400 mt-1">Вводьте через кому</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Дедлайн скасування заняття клієнтом
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={deadlineHours}
                onChange={e => setDeadlineHours(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
                className="w-24 rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-sm transition-colors focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400/60"
              />
              <span className="text-sm text-gray-500">годин до заняття</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Клієнт не зможе скасувати заняття менш ніж за {deadlineHours || 0} год
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button type="submit" loading={saving} fullWidth size="lg">
            {saving ? 'Збереження...' : saved ? 'Збережено' : 'Зберегти профіль'}
          </Button>
        </form>
      </GlassCard>
    </div>
  )
}
