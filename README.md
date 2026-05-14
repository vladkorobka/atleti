# Атлеті

SaaS-платформа для фітнес-тренерів та їх клієнтів. Тренери керують клієнтами, балансом і календарем занять. Клієнти переглядають заняття, баланс і приймають запрошення тренерів.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **MongoDB** + Mongoose — схеми в `packages/db`
- **NextAuth v5** — Google OAuth та Email/Password (bcrypt)
- **Tailwind CSS** — Liquid Glass дизайн
- **Turborepo** + pnpm workspaces

## Quick Start

```bash
# Встановити залежності
pnpm install

# Запустити dev-сервер (localhost:3000)
pnpm dev

# Unit + integration тести
pnpm test

# E2E тести (потрібен запущений dev-сервер)
pnpm test:e2e

# Build
pnpm build
```

Скопіюйте `.env.local.example` → `.env.local` та заповніть `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

## App Structure

```
apps/web/app/
  (auth)/     — реєстрація, вхід, вибір ролі
  coach/      — дашборд тренера
  client/     — дашборд клієнта
  api/        — Route Handlers
packages/
  db/         — Mongoose schemas
  ui/         — Glass UI компоненти (GlassCard, GlassModal, CalendarGrid …)
  types/      — спільні TypeScript типи
  api-client/ — fetch-хелпери
```

## Roles

### Тренер (`coach`)
- Запрошення клієнтів за нікнеймом
- Поповнення балансу занять клієнта
- Керування календарем занять
- Редагування профілю та налаштувань

### Клієнт (`client`)
- Прийняття запрошення тренера
- Перегляд балансу та списку транзакцій
- Перегляд і скасування занять у календарі
- Редагування профілю

## Git Flow

- `main` — захищена
- `stage` — production (PR з dev)
- `dev` — основна робоча гілка
- `feature/*`, `fix/*` → PR в dev
