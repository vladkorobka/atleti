# Атлеті — Design Spec
**Date:** 2026-05-13  
**Updated:** 2026-05-13 (v2)
**Status:** Approved

---

## 1. Бізнес-модель

SaaS для тренерів. Тренер реєструється, запрошує клієнтів по нікнейму. Клієнт чекає на invite.

**Ролі:** `coach` | `client`  
**Зв'язок:** один тренер — багато клієнтів. Один клієнт — один активний тренер.

### Тарифи тренера
- **Free:** максимум 10 активних клієнтів (MVP — всі тренери на Free)
- **Pro:** необмежена кількість клієнтів (майбутнє)

### Правила переходу між тренерами
1. Тренер **не може** надіслати invite клієнту, який вже має активного тренера
2. Клієнт відмовляється від поточного тренера → поточний тренер отримує сповіщення
3. Статус ClientCoach стає `terminated` → баланс клієнта обнуляється → клієнт може отримати новий invite від нового тренера
4. Питання повернення коштів вирішується офлайн між клієнтом і тренером — додаток не втручається

---

## 2. Стек

| Шар | Технологія |
|-----|-----------|
| Framework | Next.js 14+ App Router |
| Auth | NextAuth v5 — Google OAuth + Email/Password |
| DB | MongoDB + Mongoose |
| Video | Cloudflare Stream (upload з мобільного, HLS, download) |
| Storage | Cloudflare R2 (файли, фото) |
| Payments | Мокап → monobank / ПриватБанк (майбутнє) |
| Deploy | Vercel (apps/web) |
| CI/CD | GitHub Actions + Vercel CLI |
| Testing | Vitest, mongodb-memory-server, Testing Library, Playwright |
| Monorepo | Turborepo + pnpm workspaces |

---

## 3. Структура Monorepo

```
atleti/
  apps/
    web/
      app/
        (auth)/           ← login, register, role-select
        (coach)/          ← dashboard тренера
        (client)/         ← dashboard клієнта
        api/              ← Route Handlers
      components/
      lib/
  packages/
    db/                   ← Mongoose schemas + моделі
    ui/                   ← спільні компоненти (Glass UI)
    types/                ← TypeScript types (shared з майбутнім RN)
    api-client/           ← fetch-хелпери
  turbo.json
  pnpm-workspace.yaml
```

---

## 4. Авторизація

**Провайдери:**
- Google OAuth (NextAuth v5)
- Email + Password (NextAuth Credentials — bcrypt хешування)

**Флоу реєстрації:**
1. Вибір провайдера (Google або email/password)
2. Вибір ролі: `coach` | `client`
3. Введення унікального нікнейму
4. JWT сесія містить: `userId`, `role`, `nickname`

---

## 5. Моделі даних

```typescript
User {
  _id, email, name, avatar,
  role: 'coach' | 'client',
  nickname: unique,
  googleId?,
  passwordHash?,          // для email/password auth
  createdAt, updatedAt
}

CoachProfile {
  userId,
  bio, specializations[],
  workingHours: { mon..sun: { start, end, slotDuration } },
  cancellationDeadlineHours: number,  // ліміт скасування клієнтом (в годинах до заняття)
  packages: [{ name, sessions, price, currency: 'UAH' }],
  plan: 'free' | 'pro',              // free: max 10 clients
  clientLimit: number                 // 10 для free
}

ClientCoach {
  clientId, coachId,
  status: 'pending' | 'active' | 'rejected' | 'terminated',
  invitedAt, acceptedAt
}

Balance {
  clientId, coachId,
  sessionsTotal, sessionsUsed, sessionsRemaining,
  transactions: [{ type: 'topup' | 'debit', sessions, note, createdAt, recordedBy }]
}

Session {
  clientId, coachId,
  scheduledAt: Date,
  duration: number,
  type: 'regular' | 'split' | 'online' | 'consultation',
  status: 'scheduled' | 'completed' | 'cancelled',
  cancelledBy?: userId,
  cancelledByRole?: 'coach' | 'client',
  cancelReason?: string,
  createdBy: 'coach' | 'client'
}

Message {
  threadId,               // composite: clientId+coachId
  senderId,
  text?,
  attachments?: [{ type: 'video' | 'file' | 'image', url, filename, size }],
  createdAt, readAt?
}

Content {
  coachId,
  targetType: 'all' | 'client',
  targetId?,
  title, description?,
  type: 'video' | 'file',
  cloudflareVideoId?, fileUrl?,
  createdAt
}
```

**Індекси:** `User.nickname` unique, `User.email` unique, `Session.coachId+scheduledAt`, `ClientCoach.clientId+coachId` unique, `Message.threadId+createdAt`

---

## 6. Функціональні модулі

### Тренер
- Запрошення клієнта по нікнейму (блокується якщо клієнт вже має тренера)
- Ручне зарахування балансу (вибір пакету → кількість сесій)
- Місячний календар + налаштування робочих слотів
- Скасування будь-якого заняття (будь-який статус → `cancelled`)
- Зміна статусу будь-якого заняття вручну
- Налаштування дедлайну скасування (напр. 24 год до заняття)
- Завантаження відео (Cloudflare Stream) та файлів (R2)
- Публікація контенту: всім клієнтам або конкретному
- Асинхронні повідомлення з кожним клієнтом
- CRUD власних пакетів занять
- Перегляд ліміту клієнтів (Free: X/10)

### Клієнт
- Статус-екран очікування invite після реєстрації
- Перегляд балансу та транзакцій
- Місячний календар: бронювання вільних слотів у межах балансу
- Скасування заняття — тільки до дедлайну тренера; після дедлайну заняття вважається проведеним
- Перегляд та скачування контенту від тренера
- Повідомлення тренеру (включно зі скасуванням заняття + причина)
- Відмова від тренера → тренер отримує сповіщення → статус `terminated` → очікування нового invite

### Логіка скасування заняття
```
Якщо NOW < scheduledAt - cancellationDeadlineHours:
  → клієнт може скасувати самостійно
Якщо NOW >= scheduledAt - cancellationDeadlineHours:
  → кнопка скасування недоступна для клієнта
  → заняття автоматично вважається проведеним після scheduledAt
Тренер може скасувати заняття в будь-який час
Тренер може змінити статус заняття вручну в будь-який час
```

### Платіжний мокап
```
POST /api/payments/checkout  ← packageId → mock success
POST /api/payments/webhook   ← заглушка monobank/Приват
```

### In-app сповіщення
- Тренер: клієнт прийняв invite, клієнт скасував заняття, **клієнт відмовився від тренера**
- Клієнт: зарахований баланс, нове заняття від тренера, новий контент, **тренер скасував заняття**

---

## 7. Дизайн-система

**Стиль:** Apple / Liquid Glass  
**Glass ефект:** `backdrop-blur` + `bg-white/60` (Tailwind `blur-sm` / `blur-lg`)  
**Радіуси:** `rounded-md`  
**Типографіка:** Inter (SF Pro fallback на Apple)  
**Підхід:** Mobile First — `< 768px` основний, tablet 768-1024, desktop > 1024

### Адаптація ключових екранів
| Екран | Mobile | Desktop |
|-------|--------|---------|
| Календар | місяць → тап → bottom sheet | місяць + права панель |
| Контент | вертикальний список | сітка 2-3 col |
| Повідомлення | повноекранний чат | split view |
| Баланс | картка + транзакції | те саме |

### packages/ui компоненти
`GlassCard`, `GlassModal`, `Avatar`, `Badge`, `CalendarGrid`, `SessionSlot`, `VideoPlayer`, `MessageBubble`, `BalanceBadge`, `PackageCard`

---

## 8. Тестування

| Рівень | Інструмент | Покриття |
|--------|-----------|----------|
| Unit | Vitest | утиліти, бізнес-логіка балансу, дедлайн скасування, ліміт клієнтів |
| Integration | Vitest + mongodb-memory-server | API Route Handlers |
| Component | Testing Library + Vitest | packages/ui |
| E2E | Playwright | критичні флоу |

**E2E флоу:** реєстрація (Google + email/pass) → invite → зарахування балансу → бронювання → скасування в межах дедлайну → скасування після дедлайну (блок) → відмова від тренера → відео

---

## 9. CI/CD та Git

**Гілки:** `main` (захищена) ← `stage` ← `dev` ← `feature/*` / `fix/*`

```yaml
PR → dev:    typecheck + lint → Vitest → Playwright smoke → Vercel Preview
Merge → stage: всі тести → Vercel Production deploy
```

**GitHub Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MONGODB_URI`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CLOUDFLARE_STREAM_TOKEN`

---

## 10. Команда агентів

| Агент | Відповідальність |
|-------|-----------------|
| Fullstack розробник | Next.js, API, Mongoose, інтеграції |
| Дизайнер | Tailwind компоненти, Glass UI, mobile-first макети до коду |
| Тестувальник | Vitest + Playwright, edge cases |
| Суворий критик | Аудит кожного PR: безпека, масштабованість, UX |

**Workflow:** Дизайнер → Розробник → Тестувальник → Критик → (повернення або merge)  
**Дискусія:** агенти ведуть активну дискусію між собою — критикують і підтверджують рішення одне одного до досягнення консенсусу.

---

## 11. Масштабованість

- `packages/types` — shared між web і майбутнім React Native (`apps/rn`)
- Платіжний мокап ізольований за інтерфейсом — реальна інтеграція без зміни API контракту
- Cloudflare Stream — адаптивний стрімінг вже закладений
- MongoDB — горизонтальне масштабування через sharding при потребі
- `plan: 'free' | 'pro'` в CoachProfile — готовність до монетизації без міграції схеми
