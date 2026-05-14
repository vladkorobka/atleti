'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { GlassCard } from '@atleti/ui'

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
  const [deadlineHours, setDeadlineHours] = useState(24)
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
        setDeadlineHours(coachData.profile.cancellationDeadlineHours ?? 24)
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
        cancellationDeadlineHours: deadlineHours,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error?.bio?.[0] ?? 'Помилка збереження'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-xl font-semibold text-gray-900">Профіль тренера</h1>

      {/* Account section */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Акаунт</h2>
        <form onSubmit={handleAccountSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ім&apos;я</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Нікнейм</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9_]+"
                className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {!isGoogle && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Змінити пароль</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Поточний пароль</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Новий пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>
          )}

          {accountError && <p className="text-xs text-red-500">{accountError}</p>}

          <button
            type="submit"
            disabled={savingAccount}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {savingAccount ? 'Збереження...' : savedAccount ? 'Збережено' : 'Зберегти акаунт'}
          </button>
        </form>
      </GlassCard>

      {/* Coach profile section */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Профіль тренера</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Про себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Розкажіть про свій досвід та підхід до тренувань..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/1000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Спеціалізації</label>
            <input
              value={specializations}
              onChange={e => setSpecializations(e.target.value)}
              placeholder="фітнес, реабілітація, схуднення (через кому)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Вводьте через кому</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дедлайн скасування заняття клієнтом
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={168}
                value={deadlineHours}
                onChange={e => setDeadlineHours(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <span className="text-sm text-gray-500">годин до заняття</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Клієнт не зможе скасувати заняття менш ніж за {deadlineHours} год
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Збереження...' : saved ? 'Збережено' : 'Зберегти профіль'}
          </button>
        </form>
      </GlassCard>
    </div>
  )
}
