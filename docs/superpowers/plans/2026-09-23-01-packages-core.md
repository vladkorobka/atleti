# `packages/core` — винесення чистої доменної логіки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Винести з `apps/web/lib` усю чисту доменну логіку в новий пакет `@atleti/core`, щоб її міг імпортувати майбутній мобільний додаток, не тягнучи за собою Next.js.

**Architecture:** Новий workspace-пакет за зразком `@atleti/types` і `@atleti/db`: `main` вказує прямо на `src/index.ts`, збірки немає, споживачі транспілюють самі. Модулі переносяться кластерами за залежностями, щоб не переписувати внутрішні імпорти двічі. Після кожного кластера дерево лишається зеленим.

**Tech Stack:** TypeScript 5.4, Vitest 1.6, zod 4.4, pnpm workspaces, Turborepo

**Spec:** [`docs/superpowers/specs/2026-09-23-atleti-mobile-rn-design.md`](../specs/2026-09-23-atleti-mobile-rn-design.md), секція 1

## Global Constraints

- Пакет називається `@atleti/core`, версія `0.0.1`, поле `main` і `types` — `./src/index.ts`.
- **`packages/core` не має жодної серверної залежності.** Дозволені залежності: `zod` і `@atleti/types`. Ніякого `mongoose`, `next`, `bcryptjs`, `react`.
- **Поведінка коду не змінюється.** Це перенесення, а не рефакторинг. Тіла функцій, назви експортів і сигнатури лишаються байт-у-байт.
- Веб-UI не чіпаємо: у сторінках і компонентах міняється **тільки рядок імпорту**.
- Коментарі в перенесених файлах зберігаються як є — вони пояснюють неочевидне WHY.
- Мова коміт-меседжів — українська, за зразком наявної історії.
- Не додавати трейлер `Co-Authored-By` до комітів.
- **Ніколи не запускати `git add -A`, `git add .` чи `git add apps/web`.** У робочому дереві є чужа незакомічена зміна в `apps/web/app/coach/clients/[clientId]/AnamnesisCard.tsx`, яка до цього плану не стосується. Додавати тільки явні шляхи зі списку в кроці коміту. Файл `AnamnesisCard.tsx` не чіпати й не комітити за жодних обставин.

## Чому тут немає класичного red-green

Це перенесення наявного коду, який уже покритий тестами й уже зелений. Червона фаза тут справжня, але іншої природи: після того, як файл переїхав, а імпорти ще не оновлені, прогін падає з «Cannot find module». Саме це падіння й доводить, що ми знайшли всіх споживачів. Кожна задача проходить цикл «перенести → побачити падіння → полагодити імпорти → зелено → коміт».

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/core/package.json` | маніфест пакета |
| `packages/core/tsconfig.json` | компіляція, копія з `packages/db` |
| `packages/core/vitest.config.ts` | прогін тестів пакета |
| `packages/core/src/index.ts` | єдина точка експорту |
| `packages/core/src/tz.ts` | київська таймзона |
| `packages/core/src/slot-utils.ts` | генерація слотів, блоки |
| `packages/core/src/coach-schedule.ts` | перевірка робочого графіка |
| `packages/core/src/session-conflict.ts` | накладання занять, межі |
| `packages/core/src/session-utils.ts` | скасування клієнтом, підписи статусів |
| `packages/core/src/balance.ts` | арифметика балансу |
| `packages/core/src/validations/client.ts` | zod-схеми клієнта |
| `packages/core/src/validations/coach.ts` | zod-схеми тренера |
| `packages/core/src/__tests__/*.test.ts` | шість перенесених тестів |

**Видаляються після перенесення:** ті самі вісім модулів з `apps/web/lib` і шість тестів з `apps/web/__tests__/lib/`.

**Лишаються в `apps/web/lib`:** `auth.ts`, `auth.config.ts`, `db.ts`, `email.ts`, `email-templates.ts`, `settle-sessions.ts`, `coach-utils.ts`, `middleware-utils.ts` — усі торкаються БД, пошти або сесії.

> `coach-utils.ts` чистий, але його імпортують лише два серверні роути, а не UI. Мобільному додатку він не потрібен, тож за YAGNI лишається на місці.

---

### Task 1: Пакет `@atleti/core` і кластер таймзони та слотів

Переносяться разом, бо `slot-utils` імпортує `tz`, а `coach-schedule` імпортує обидва. Поодинці довелося б правити внутрішні імпорти двічі.

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`
- Move: `apps/web/lib/tz.ts` → `packages/core/src/tz.ts`
- Move: `apps/web/lib/slot-utils.ts` → `packages/core/src/slot-utils.ts`
- Move: `apps/web/lib/coach-schedule.ts` → `packages/core/src/coach-schedule.ts`
- Move: `apps/web/__tests__/lib/tz.test.ts` → `packages/core/src/__tests__/tz.test.ts`
- Move: `apps/web/__tests__/lib/slot-utils.test.ts` → `packages/core/src/__tests__/slot-utils.test.ts`
- Move: `apps/web/__tests__/lib/coach-schedule.test.ts` → `packages/core/src/__tests__/coach-schedule.test.ts`
- Modify: `apps/web/package.json` (крок 8) і 11 файлів зі списку в кроці 9

**Interfaces:**
- Consumes: `@atleti/types` — типи `ICoachBlock`, `DowKey`, `IWorkingHoursDay`
- Produces: з `@atleti/core` стають доступні
  `APP_TZ`, `KyivParts`, `kyivParts(date: Date): KyivParts`, `kyivWallTimeToUtc`, `kyivInputToUtc(dateStr: string, timeStr: string): Date`, `formatKyiv(date: Date | string, opts: Intl.DateTimeFormatOptions): string`, `kyivDateInput(date: Date): string`, `kyivTimeInput(date: Date): string`, `SlotDowKey`, `kyivSlotParts(d: Date): { date: string; dowKey: SlotDowKey; startMin: number }`,
  `parseMinutes(time: string): number`, `generateSlots(start: string, end: string, durationMin: number): string[]`, `isBlockExpired(block: ICoachBlock, now: Date): boolean`, `isDayBlocked(blocks: ICoachBlock[], date: string, dowKey: DowKey): boolean`, `getBlockedSlots`, `getSlotBlock`, `getTimeBlocksForDate(blocks: ICoachBlock[], date: string, dowKey: DowKey): ICoachBlock[]`, `timeBlockConflict`,
  `ScheduleCheckResult`, `checkWithinSchedule`, `slotParts` (аліас `kyivSlotParts`)

- [ ] **Крок 1: Створити маніфест пакета**

`packages/core/package.json`:

```json
{
  "name": "@atleti/core",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.4.3",
    "@atleti/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Крок 2: Створити конфіги**

`packages/core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Крок 3: Перенести три модулі без жодної зміни вмісту**

```bash
mkdir -p packages/core/src/__tests__
git mv apps/web/lib/tz.ts packages/core/src/tz.ts
git mv apps/web/lib/slot-utils.ts packages/core/src/slot-utils.ts
git mv apps/web/lib/coach-schedule.ts packages/core/src/coach-schedule.ts
git mv apps/web/__tests__/lib/tz.test.ts packages/core/src/__tests__/tz.test.ts
git mv apps/web/__tests__/lib/slot-utils.test.ts packages/core/src/__tests__/slot-utils.test.ts
git mv apps/web/__tests__/lib/coach-schedule.test.ts packages/core/src/__tests__/coach-schedule.test.ts
```

Внутрішні імпорти між цими трьома файлами (`./tz`, `./slot-utils`) правити **не треба** — відносні шляхи збереглися.

- [ ] **Крок 4: Полагодити шляхи в перенесених тестах**

Тести лежали на два рівні глибше й тягнулися через `../../lib/`. Тепер вони поруч із кодом.

`packages/core/src/__tests__/tz.test.ts`, рядок 2:
```ts
import { kyivInputToUtc, kyivParts, formatKyiv, kyivDateInput, kyivTimeInput, kyivSlotParts } from '../tz'
```

`packages/core/src/__tests__/slot-utils.test.ts`, рядок 2:
```ts
import { generateSlots, isDayBlocked, getBlockedSlots, getSlotBlock, timeBlockConflict, getTimeBlocksForDate, isBlockExpired } from '../slot-utils'
```

`packages/core/src/__tests__/coach-schedule.test.ts`, рядок 2:
```ts
import { checkWithinSchedule, slotParts } from '../coach-schedule'
```

- [ ] **Крок 5: Створити точку експорту**

`packages/core/src/index.ts`:

```ts
export * from './tz'
export * from './slot-utils'
export * from './coach-schedule'
```

- [ ] **Крок 6: Встановити залежність і переконатися, що тести пакета зелені**

```bash
pnpm install
pnpm --filter @atleti/core test
```

Очікування: три файли, усі тести проходять. Якщо `pnpm install` не бачить пакет — перевірити, що `pnpm-workspace.yaml` містить `packages/*` (він містить).

- [ ] **Крок 7: Побачити падіння вебу — це доказ, що ми знайшли всіх споживачів**

```bash
pnpm --filter @atleti/web test
```

Очікування: FAIL з «Cannot find module '@/lib/tz'» і подібними. Записати список файлів, що впали, і звірити зі списком у наступному кроці.

- [ ] **Крок 8: Додати `@atleti/core` в залежності вебу**

У `apps/web/package.json`, у блок `dependencies`, поруч із `@atleti/db`:

```json
    "@atleti/core": "workspace:*",
```

Потім `pnpm install`.

- [ ] **Крок 9: Оновити 10 імпортів**

Кожен рядок замінюється цілком. Ліворуч — файл і номер рядка, праворуч — новий текст.

`apps/web/app/api/coach/available-slots/route.ts:6-7` — два рядки згортаються в один:
```ts
import { generateSlots, isDayBlocked, getBlockedSlots, kyivInputToUtc, kyivParts } from '@atleti/core'
```

`apps/web/app/api/client/sessions/route.ts:8-9` — два рядки згортаються в один:
```ts
import { generateSlots, slotParts } from '@atleti/core'
```

`apps/web/app/api/coach/sessions/route.ts:9`:
```ts
import { checkWithinSchedule, slotParts } from '@atleti/core'
```

`apps/web/app/api/coach/sessions/[sessionId]/route.ts:8`:
```ts
import { checkWithinSchedule, slotParts } from '@atleti/core'
```

`apps/web/app/client/dashboard/page.tsx:10`:
```ts
import { formatKyiv } from '@atleti/core'
```

`apps/web/app/client/sessions/ClientCalendar.tsx:5`:
```ts
import { kyivParts, formatKyiv, kyivInputToUtc } from '@atleti/core'
```

`apps/web/app/coach/calendar/CalendarClient.tsx:6-7` — два рядки згортаються в один:
```ts
import { generateSlots, isDayBlocked, getSlotBlock, isBlockExpired, kyivInputToUtc, kyivParts, kyivDateInput } from '@atleti/core'
```

`apps/web/app/coach/clients/[clientId]/page.tsx:12`:
```ts
import { formatKyiv } from '@atleti/core'
```

`apps/web/app/coach/dashboard/page.tsx:9`:
```ts
import { formatKyiv } from '@atleti/core'
```

`apps/web/__tests__/api/client/booking.test.ts:4`:
```ts
import { kyivInputToUtc } from '@atleti/core'
```

`apps/web/__tests__/api/coach/sessions.test.ts:4`:
```ts
import { kyivInputToUtc, kyivDateInput } from '@atleti/core'
```

- [ ] **Крок 10: Прогін — має стати зелено**

```bash
pnpm --filter @atleti/web test
pnpm typecheck
```

Очікування: обидві команди успішні. Якщо десь лишився `@/lib/tz`, `@/lib/slot-utils` чи `@/lib/coach-schedule` — знайти залишок:

```bash
grep -rn "@/lib/\(tz\|slot-utils\|coach-schedule\)" apps/web --include=*.ts --include=*.tsx | grep -v node_modules
```

Очікування: порожній вивід.

- [ ] **Крок 11: Коміт**

```bash
git add packages/core pnpm-lock.yaml apps/web/package.json \
  apps/web/lib apps/web/__tests__ \
  "apps/web/app/api/coach/available-slots/route.ts" \
  "apps/web/app/api/client/sessions/route.ts" \
  "apps/web/app/api/coach/sessions/route.ts" \
  "apps/web/app/api/coach/sessions/[sessionId]/route.ts" \
  "apps/web/app/client/dashboard/page.tsx" \
  "apps/web/app/client/sessions/ClientCalendar.tsx" \
  "apps/web/app/coach/calendar/CalendarClient.tsx" \
  "apps/web/app/coach/clients/[clientId]/page.tsx" \
  "apps/web/app/coach/dashboard/page.tsx"
git commit -m "refactor(core): винести таймзону, слоти й робочий графік у @atleti/core

Перший крок до мобільного додатка: ці модулі чисті й потрібні React Native,
але лежали в apps/web/lib. Поведінка не змінена, тести перенесені разом
із кодом і проходять з нового місця."
```

---

### Task 2: Накладання занять і статуси

**Files:**
- Move: `apps/web/lib/session-conflict.ts` → `packages/core/src/session-conflict.ts`
- Move: `apps/web/lib/session-utils.ts` → `packages/core/src/session-utils.ts`
- Move: `apps/web/__tests__/lib/session-conflict.test.ts` → `packages/core/src/__tests__/session-conflict.test.ts`
- Move: `apps/web/__tests__/lib/session-utils.test.ts` → `packages/core/src/__tests__/session-utils.test.ts`
- Modify: `packages/core/src/index.ts`, чотири файли зі списку в кроці 4

**Interfaces:**
- Consumes: `@atleti/types` — тип `SessionStatus`
- Produces: `SessionInterval`, `intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean`, `hasBlockingConflict`, `MAX_SESSION_DURATION_MIN` (480), `MAX_BACKDATE_DAYS` (365), `canClientCancel(scheduledAt: Date, deadlineHours: number): boolean`, `getSessionStatusLabel(status: SessionStatus): string`

- [ ] **Крок 1: Перенести**

```bash
git mv apps/web/lib/session-conflict.ts packages/core/src/session-conflict.ts
git mv apps/web/lib/session-utils.ts packages/core/src/session-utils.ts
git mv apps/web/__tests__/lib/session-conflict.test.ts packages/core/src/__tests__/session-conflict.test.ts
git mv apps/web/__tests__/lib/session-utils.test.ts packages/core/src/__tests__/session-utils.test.ts
```

- [ ] **Крок 2: Полагодити шляхи в тестах**

`packages/core/src/__tests__/session-conflict.test.ts`, рядок 2:
```ts
import { intervalsOverlap, hasBlockingConflict } from '../session-conflict'
```

`packages/core/src/__tests__/session-utils.test.ts`, рядок 2:
```ts
import { canClientCancel, getSessionStatusLabel } from '../session-utils'
```

- [ ] **Крок 3: Розширити точку експорту**

`packages/core/src/index.ts` — додати два рядки:

```ts
export * from './session-conflict'
export * from './session-utils'
```

- [ ] **Крок 4: Побачити падіння, потім оновити чотири імпорти**

```bash
pnpm --filter @atleti/web test
```

Очікування: FAIL з «Cannot find module '@/lib/session-conflict'».

`apps/web/app/api/coach/sessions/route.ts:8`:
```ts
import { hasBlockingConflict, MAX_SESSION_DURATION_MIN, MAX_BACKDATE_DAYS } from '@atleti/core'
```

`apps/web/app/api/coach/sessions/[sessionId]/route.ts:7`:
```ts
import { hasBlockingConflict, MAX_SESSION_DURATION_MIN } from '@atleti/core'
```

`apps/web/app/api/client/sessions/[sessionId]/route.ts:6`:
```ts
import { canClientCancel } from '@atleti/core'
```

`apps/web/app/coach/calendar/CalendarClient.tsx:8`:
```ts
import { MAX_BACKDATE_DAYS } from '@atleti/core'
```

- [ ] **Крок 5: Прогін**

```bash
pnpm --filter @atleti/core test
pnpm --filter @atleti/web test
pnpm typecheck
grep -rn "@/lib/session-conflict\|@/lib/session-utils" apps/web --include=*.ts --include=*.tsx | grep -v node_modules
```

Очікування: тести зелені, `grep` повертає порожньо.

- [ ] **Крок 6: Коміт**

```bash
git add packages/core apps/web/lib apps/web/__tests__ \
  "apps/web/app/api/coach/sessions/route.ts" \
  "apps/web/app/api/coach/sessions/[sessionId]/route.ts" \
  "apps/web/app/api/client/sessions/[sessionId]/route.ts" \
  "apps/web/app/coach/calendar/CalendarClient.tsx"
git commit -m "refactor(core): винести накладання занять і статуси в @atleti/core"
```

---

### Task 3: Арифметика балансу

**Files:**
- Move: `apps/web/lib/balance.ts` → `packages/core/src/balance.ts`
- Move: `apps/web/__tests__/lib/balance.test.ts` → `packages/core/src/__tests__/balance.test.ts`
- Modify: `packages/core/src/index.ts`, п'ять файлів зі списку в кроці 4

**Interfaces:**
- Consumes: нічого зовнішнього
- Produces: `sessionsDebt(b): number`, `sessionsAvailable(b, reserved: number): number`, `pluralSessions(n: number): string`, де `b` має форму `{ sessionsTotal: number; sessionsUsed: number }`

> Інтерфейс `BalanceCounts` у файлі оголошений, але **не експортований**. Переносимо як є — додавати `export` означало б міняти публічну поверхню, а цей план нічого не міняє. Якщо мобільному додатку знадобиться назвати цей тип, `export` додасть окремий план.

- [ ] **Крок 1: Перенести**

```bash
git mv apps/web/lib/balance.ts packages/core/src/balance.ts
git mv apps/web/__tests__/lib/balance.test.ts packages/core/src/__tests__/balance.test.ts
```

- [ ] **Крок 2: Полагодити шлях у тесті**

`packages/core/src/__tests__/balance.test.ts`, рядок 2 — цей тест єдиний із шести ходив через аліас `@/`, тож шлях міняється на відносний:

```ts
import { sessionsDebt, sessionsAvailable, pluralSessions } from '../balance'
```

- [ ] **Крок 3: Розширити точку експорту**

`packages/core/src/index.ts` — додати рядок:

```ts
export * from './balance'
```

- [ ] **Крок 4: Побачити падіння, потім оновити п'ять імпортів**

```bash
pnpm --filter @atleti/web test
```

Очікування: FAIL з «Cannot find module '@/lib/balance'».

`apps/web/app/api/client/balance/route.ts:7`:
```ts
import { sessionsAvailable, sessionsDebt } from '@atleti/core'
```

`apps/web/app/client/balance/page.tsx:8`:
```ts
import { sessionsAvailable, sessionsDebt, pluralSessions } from '@atleti/core'
```

`apps/web/app/client/dashboard/page.tsx:11` — цей файл уже імпортує `formatKyiv` з `@atleti/core` (Task 1, крок 9). Два імпорти згортаються в один рядок, старий рядок 11 видаляється:
```ts
import { formatKyiv, sessionsAvailable, sessionsDebt, pluralSessions } from '@atleti/core'
```

`apps/web/app/client/sessions/ClientCalendar.tsx:6` — так само згортається з рядком 5:
```ts
import { kyivParts, formatKyiv, kyivInputToUtc, sessionsAvailable, sessionsDebt, pluralSessions } from '@atleti/core'
```

`apps/web/app/coach/clients/[clientId]/page.tsx:13` — так само згортається з рядком 12:
```ts
import { formatKyiv, pluralSessions } from '@atleti/core'
```

- [ ] **Крок 5: Прогін**

```bash
pnpm --filter @atleti/core test
pnpm --filter @atleti/web test
pnpm typecheck
grep -rn "@/lib/balance" apps/web --include=*.ts --include=*.tsx | grep -v node_modules
```

Очікування: тести зелені, `grep` повертає порожньо.

- [ ] **Крок 6: Коміт**

```bash
git add packages/core apps/web/lib apps/web/__tests__ \
  "apps/web/app/api/client/balance/route.ts" \
  "apps/web/app/client/balance/page.tsx" \
  "apps/web/app/client/dashboard/page.tsx" \
  "apps/web/app/client/sessions/ClientCalendar.tsx" \
  "apps/web/app/coach/clients/[clientId]/page.tsx"
git commit -m "refactor(core): винести арифметику балансу в @atleti/core"
```

---

### Task 4: Zod-схеми

Мобільному додатку вони потрібні для валідації форм до відправки — тими самими правилами, якими сервер перевіряє після.

**Files:**
- Move: `apps/web/lib/validations/client.ts` → `packages/core/src/validations/client.ts`
- Move: `apps/web/lib/validations/coach.ts` → `packages/core/src/validations/coach.ts`
- Modify: `packages/core/src/index.ts`, десять роутів зі списку в кроці 3
- Delete: порожня тека `apps/web/lib/validations/`

**Interfaces:**
- Consumes: `zod`
- Produces: `clientCancelSchema`, `bookingSchema`, `coachProfileSchema`, `inviteSchema`, `balanceTopupSchema`, `anamnesisSchema`, `sessionCreateSchema`, `sessionUpdateSchema`, `sessionEditSchema`, `coachBlockSchema`

- [ ] **Крок 1: Перенести**

```bash
mkdir -p packages/core/src/validations
git mv apps/web/lib/validations/client.ts packages/core/src/validations/client.ts
git mv apps/web/lib/validations/coach.ts packages/core/src/validations/coach.ts
```

Тестів у цих файлів немає — вони покриті опосередковано через роутові тести, які лишаються у вебі.

- [ ] **Крок 2: Розширити точку експорту**

`packages/core/src/index.ts` — додати два рядки:

```ts
export * from './validations/client'
export * from './validations/coach'
```

- [ ] **Крок 3: Побачити падіння, потім оновити десять імпортів**

```bash
pnpm --filter @atleti/web test
```

Очікування: FAIL з «Cannot find module '@/lib/validations/coach'».

`apps/web/app/api/client/sessions/route.ts:7` — згортається з рядком 8, який уже вказує на `@atleti/core` після Task 1:
```ts
import { bookingSchema, generateSlots, slotParts } from '@atleti/core'
```

`apps/web/app/api/coach/blocks/route.ts:6`:
```ts
import { coachBlockSchema } from '@atleti/core'
```

`apps/web/app/api/coach/blocks/[blockId]/route.ts:6`:
```ts
import { coachBlockSchema } from '@atleti/core'
```

`apps/web/app/api/coach/clients/invite/route.ts:7`:
```ts
import { inviteSchema } from '@atleti/core'
```

`apps/web/app/api/coach/clients/[clientId]/balance/route.ts:6`:
```ts
import { balanceTopupSchema } from '@atleti/core'
```

`apps/web/app/api/coach/clients/[clientId]/route.ts:6`:
```ts
import { anamnesisSchema } from '@atleti/core'
```

`apps/web/app/api/coach/profile/route.ts:6`:
```ts
import { coachProfileSchema } from '@atleti/core'
```

`apps/web/app/api/coach/settings/route.ts:6`:
```ts
import { coachProfileSchema } from '@atleti/core'
```

`apps/web/app/api/coach/sessions/route.ts:6` — згортається з рядками 8 і 9, які вже вказують на `@atleti/core`:
```ts
import { sessionCreateSchema, hasBlockingConflict, MAX_SESSION_DURATION_MIN, MAX_BACKDATE_DAYS, checkWithinSchedule, slotParts } from '@atleti/core'
```

`apps/web/app/api/coach/sessions/[sessionId]/route.ts:6` — так само згортається з рядками 7 і 8:
```ts
import { sessionUpdateSchema, sessionEditSchema, hasBlockingConflict, MAX_SESSION_DURATION_MIN, checkWithinSchedule, slotParts } from '@atleti/core'
```

- [ ] **Крок 4: Прибрати порожню теку**

```bash
rmdir apps/web/lib/validations
```

- [ ] **Крок 5: Прогін**

```bash
pnpm --filter @atleti/web test
pnpm typecheck
grep -rn "@/lib/validations" apps/web --include=*.ts --include=*.tsx | grep -v node_modules
```

Очікування: тести зелені, `grep` повертає порожньо.

- [ ] **Крок 6: Коміт**

```bash
git add packages/core apps/web/lib \
  "apps/web/app/api/client/sessions/route.ts" \
  "apps/web/app/api/coach/blocks/route.ts" \
  "apps/web/app/api/coach/blocks/[blockId]/route.ts" \
  "apps/web/app/api/coach/clients/invite/route.ts" \
  "apps/web/app/api/coach/clients/[clientId]/balance/route.ts" \
  "apps/web/app/api/coach/clients/[clientId]/route.ts" \
  "apps/web/app/api/coach/profile/route.ts" \
  "apps/web/app/api/coach/settings/route.ts" \
  "apps/web/app/api/coach/sessions/route.ts" \
  "apps/web/app/api/coach/sessions/[sessionId]/route.ts"
git commit -m "refactor(core): винести zod-схеми в @atleti/core

Мобільний додаток валідуватиме форми тими самими правилами, якими
сервер перевіряє запити."
```

---

### Task 5: Повна перевірка й фіксація межі пакета

Остання задача не додає коду — вона доводить, що пакет справді чистий і що веб не постраждав.

**Files:**
- Create: `packages/core/src/__tests__/purity.test.ts`
- Modify: `CLAUDE.md` — розділ «Структура»

**Interfaces:**
- Consumes: усе з попередніх задач
- Produces: нічого нового

- [ ] **Крок 1: Написати тест, що падає, якщо в пакет заповзе серверна залежність**

Межа пакета — головне, що ми тут захищаємо. Якщо хтось колись імпортує `mongoose` у `packages/core`, мобільна збірка зламається далеко звідси й незрозуміло чому. Тест ловить це одразу.

`packages/core/src/__tests__/purity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Vitest виконує тести як ESM, де __dirname не існує — шлях беремо з import.meta.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = ['mongoose', '@atleti/db', 'next', 'react', 'bcryptjs', 'next-auth']

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : collectSourceFiles(full)
    }
    return full.endsWith('.ts') ? [full] : []
  })
}

describe('межа пакета', () => {
  it('жоден модуль не імпортує серверних залежностей', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const dep of FORBIDDEN) {
        if (source.includes(`from '${dep}'`) || source.includes(`from "${dep}"`)) {
          offenders.push(`${file} → ${dep}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
```

- [ ] **Крок 2: Прогін — має бути зелено одразу**

```bash
pnpm --filter @atleti/core test
```

Очікування: PASS. Якщо падає — значить у пакет справді заповзла серверна залежність під час перенесення, і це треба виправити, а не послабити тест.

- [ ] **Крок 3: Перевірити, що пакет дійсно самодостатній**

```bash
pnpm --filter @atleti/core typecheck
```

Очікування: без помилок. Це доводить, що `packages/core` компілюється поза контекстом Next.js і його аліасів.

- [ ] **Крок 4: Повний прогін монорепо**

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Очікування: усі чотири успішні. `pnpm build` тут критичний — він збирає Next.js і виявить зламані імпорти в сторінках, яких тести не торкаються.

- [ ] **Крок 5: Прогін e2e**

```bash
pnpm --filter @atleti/web test:e2e
```

Очікування: чотири специфікації проходять. Це остання лінія оборони: перенесення таймзони могло зачепити відображення дат у календарі, і саме e2e це побачить.

Якщо Playwright не налаштований локально — `pnpm --filter @atleti/web exec playwright install` перед прогоном.

- [ ] **Крок 6: Оновити опис структури в CLAUDE.md**

У розділі «Структура», у блоці `packages/`, замінити рядок про `api-client` на `core`:

```
packages/
  db/           — Mongoose schemas
  ui/           — Glass UI компоненти
  types/        — shared TypeScript types
  core/         — чиста доменна логіка: таймзона, слоти, графік, баланс, zod-схеми
```

`api-client` зараз описаний у CLAUDE.md, але в коді його немає — прибираємо запис про неіснуюче. Наступний план створить пакет і поверне рядок.

- [ ] **Крок 7: Коміт**

```bash
git add packages/core CLAUDE.md
git commit -m "test(core): зафіксувати межу пакета й оновити структуру в CLAUDE.md

Тест межі падає, якщо в packages/core з'явиться mongoose, next, react
чи інша серверна залежність — інакше мобільна збірка зламалася б далеко
від причини."
```

---

## Визначення готовності

План виконано, коли всі п'ять задач закриті й одночасно справджується:

1. `pnpm test` зелений — 26 тестових файлів, шість із них тепер у `packages/core`.
2. `pnpm typecheck` і `pnpm build` без помилок.
3. `pnpm --filter @atleti/web test:e2e` — чотири специфікації проходять.
4. `pnpm --filter @atleti/core typecheck` проходить окремо від вебу.
5. У `apps/web` не лишилося жодного імпорту `@/lib/tz`, `@/lib/slot-utils`, `@/lib/coach-schedule`, `@/lib/session-conflict`, `@/lib/session-utils`, `@/lib/balance`, `@/lib/validations/*`.
6. Тест межі пакета зелений.
7. Поведінка вебу не змінилася — жодного правленого рядка поза імпортами.

## Наступний план

`docs/superpowers/plans/2026-09-23-02-mobile-auth.md` — автентифікація для мобільного клієнта: `getAuthUser`, схема `Device`, три роути входу, переведення 23 наявних роутів. Пишеться після того, як цей план виконано й прийнято.
