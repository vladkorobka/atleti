# Атлеті — CLAUDE.md

## Проект
SaaS платформа для фітнес-тренерів і їх клієнтів.
Робоча назва: Атлеті. Мова UI: українська.

## Швидкий старт
```bash
pnpm install
pnpm dev          # запуск apps/web на localhost:3000
pnpm test         # Vitest unit + integration
pnpm test:e2e     # Playwright
pnpm build        # turbo build
```

## Стек
- Next.js 14+ App Router, TypeScript, Tailwind CSS
- MongoDB + Mongoose (`packages/db`)
- NextAuth v5 — Google OAuth + Email/Password (bcrypt)
- Cloudflare Stream (відео), Cloudflare R2 (файли)
- Vercel deploy, GitHub Actions CI/CD
- Turborepo + pnpm workspaces

## Структура
```
apps/web/app/
  (auth)/       — login, register, role-select
  (coach)/      — dashboard тренера
  (client)/     — dashboard клієнта
  api/          — Route Handlers
packages/
  db/           — Mongoose schemas
  ui/           — Glass UI компоненти
  types/        — shared TypeScript types
  api-client/   — fetch-хелпери
```

## Ролі
- `coach` — тренер: запрошує клієнтів, керує балансом, контентом, календарем
- `client` — клієнт: чекає invite, бронює заняття, переглядає контент

## Дизайн
- Apple / Liquid Glass стиль
- Mobile First (< 768px основний)
- Glass: `backdrop-blur` + `bg-white/60`, blur-sm / blur-lg
- Радіуси: `rounded-md`
- Компоненти: `packages/ui` — GlassCard, GlassModal, CalendarGrid, VideoPlayer тощо

## Git
- `main` — захищена (не чіпати)
- `stage` — production (merge з dev через PR)
- `dev` — основна робоча гілка
- `feature/*`, `fix/*` — фічі → PR в dev

## CI/CD
- PR → dev: lint + typecheck → Vitest → Playwright smoke → Vercel Preview
- Merge → stage: всі тести → Vercel Production

## Агенти команди
Детально: `.claude/agents.md`

## Контекст проекту
Детально: `.claude/context.md`

## Специфікація
`docs/superpowers/specs/2026-05-13-atleti-design.md`

## Правила розробки
- Коментарі тільки для неочевидного WHY
- Без зайвих абстракцій — YAGNI
- Платіжний мокап ізольований за інтерфейсом (`/api/payments/`)
- Тести пишуться паралельно з кодом, не після
- Дизайнер надає Tailwind-макет до реалізації екрану
- Критик аудитує кожен PR перед merge
- Агенти ведуть активну дискусію між собою до консенсусу перед merge
