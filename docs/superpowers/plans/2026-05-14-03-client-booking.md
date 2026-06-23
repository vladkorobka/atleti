# Plan 3: Client Booking Module

**Date:** 2026-05-14  
**Status:** In Progress  
**Goal:** Реалізувати бронювання клієнтом вільних слотів у календарі тренера за умови позитивного балансу.

**Architecture:** Клієнт бачить місячний календар. Натискає день — отримує список вільних слотів тренера (розраховані з `workingHours`, мінус вже заброньовані). Обирає слот — POST → Session, баланс дебітується на 1 заняття.

---

## Що потрібно

### Backend

**Task 1: GET /api/coach/available-slots**

Route Handler тільки для `role: client`. Повертає вільні слоти тренера клієнта на вказану дату.

```
GET /api/coach/available-slots?date=YYYY-MM-DD
```

Логіка:
1. Auth: client
2. Знайти активний `ClientCoach` → отримати `coachId`
3. Знайти `CoachProfile.workingHours` для дня тижня дати
4. Якщо день не робочий → повернути `{ slots: [] }`
5. Генерувати слоти: `start` → `end` з кроком `slotDuration` хвилин
6. Знайти `Session` де `coachId`, `scheduledAt` між початком і кінцем дня, `status: 'scheduled'`
7. Виключити зайняті слоти → повернути вільні `{ slots: ["09:00", "10:00", ...] }`

**Task 2: POST /api/client/sessions**

Route Handler тільки для `role: client`. Бронює слот.

```
POST /api/client/sessions
Body: { scheduledAt: ISO string, type: "regular" | "online" | "consultation" | "split" }
```

Логіка:
1. Auth: client
2. Знайти активний `ClientCoach` → `coachId`
3. Перевірити `Balance.sessionsRemaining > 0` — якщо ні, повернути 402
4. Перевірити що `scheduledAt > now`
5. Перевірити що слот вписується в `workingHours` тренера
6. Перевірити що слот не зайнятий (немає `Session` з `status: 'scheduled'` в ту саму хвилину для coachId)
7. Створити `Session` з `createdBy: 'client'`
8. Дебітувати баланс: `sessionsUsed += 1`, додати транзакцію `{ type: 'debit', sessions: 1, recordedBy: clientId }`
9. Повернути `{ session }`

### Frontend

**Task 3: Оновити ClientCalendar.tsx**

Поточний стан: показує тільки існуючі заняття + скасування.

Необхідні зміни:
- При виборі дня: завантажити вільні слоти `GET /api/coach/available-slots?date=YYYY-MM-DD`
- Показати: список `selectedDaySessions` (як є) + секція "Вільні слоти" з кнопками
- Кнопка слоту → модальне вікно / inline форма вибору типу заняття → POST → перезавантаження
- Показувати баланс у верхній частині (GET /api/client/balance)
- Якщо баланс 0 → слоти показати, але кнопка неактивна з підказкою "Поповніть баланс"

---

## Edge Cases

- Подвійне бронювання: два клієнти одночасно → race condition → перевірка на рівні DB + атомарна операція або `findOneAndUpdate` з умовою
- Слот у минулому → 400
- Баланс = 0 → 402 (Payment Required)
- Тренер не встановив робочі години → `{ slots: [] }`
- Клієнт без активного тренера → 403

---

## Тести

**Unit (Vitest):**
- `generateSlots(start, end, duration)` — правильно ділить час на слоти
- `isSlotAvailable(slot, sessions)` — коректно виключає зайняті

**Integration (Vitest + mongodb-memory-server):**
- `GET /api/coach/available-slots` повертає правильні слоти
- `POST /api/client/sessions` з балансом 0 → 402
- `POST /api/client/sessions` подвійне бронювання → 409
- `POST /api/client/sessions` слот у минулому → 400
- `POST /api/client/sessions` успішне бронювання → session + balance debit

**E2E (Playwright):**
- Клієнт бачить вільні слоти → бронює → бачить заняття в календарі

---

## Файли

```
apps/web/app/api/coach/available-slots/route.ts   ← NEW
apps/web/app/api/client/sessions/route.ts          ← ADD POST
apps/web/app/client/sessions/ClientCalendar.tsx    ← UPDATE
apps/web/lib/slot-utils.ts                         ← NEW (generateSlots)
apps/web/lib/validations/client.ts                 ← ADD bookingSchema
apps/web/__tests__/api/client-booking.test.ts      ← NEW
```

---

## Self-Review

**Spec coverage (після виконання):**
- [ ] Місячний календар: бронювання вільних слотів у межах балансу
- [ ] Перевірка балансу перед бронюванням (sessionsRemaining > 0)
- [ ] Слот у межах workingHours тренера
- [ ] Подвійне бронювання заблоковане
- [ ] Баланс дебітується при бронюванні
- [ ] UI показує вільні слоти + стан балансу
