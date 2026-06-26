'use client';
import { useState } from 'react';
import { GlassCard, Select, Button, Input } from '@atleti/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'client',
    nickname: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }
    // Акаунт ще НЕ створено — створиться після підтвердження email за посиланням у листі
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <GlassCard className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-3 text-center">Майже готово</h1>
        <p className="text-sm text-gray-600 text-center">
          Ми надіслали лист на <span className="font-medium">{form.email}</span>
          . Перейдіть за посиланням у листі, щоб підтвердити email і завершити
          реєстрацію.
        </p>
        <p className="text-center text-xs text-gray-500 mt-4">
          Не отримали лист? Перевірте «Спам» або{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="underline hover:text-gray-700"
          >
            спробуйте ще раз
          </button>
          .
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-6 text-center">Реєстрація</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Ім'я"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <Input
          placeholder="Пароль (мін. 8 символів)"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
        <Input
          placeholder="Нікнейм"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-z0-9._]+"
          value={form.nickname}
          onChange={(e) =>
            set(
              'nickname',
              e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''),
            )
          }
          leftIcon={<span className="text-sm">@</span>}
        />
        <p className="text-xs text-gray-500 -mt-1.5 px-0.5">
          Латинські літери, цифри, крапка та підкреслення (напр.{' '}
          <span className="font-medium">john_smith</span>).
          {form.role === 'client' &&
            ' Саме за ним тренер знайде вас для запрошення — оберіть такий, який зможете повідомити тренеру.'}
        </p>
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
        Вже є акаунт?{' '}
        <a href="/login" className="underline hover:text-gray-700">
          Увійти
        </a>
      </p>
    </GlassCard>
  );
}
