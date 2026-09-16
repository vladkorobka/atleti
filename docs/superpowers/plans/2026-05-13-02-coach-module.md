# Coach Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реалізувати повний функціонал тренера: профіль, пакети послуг, запрошення клієнтів, управління балансом, місячний календар занять зі слотами, управління статусами занять.

**Architecture:** Next.js App Router — Server Components для даних, Client Components для інтерактивності. API Route Handlers у `/api/coach/`. Бізнес-логіка (перевірка лімітів, дедлайнів, слотів) ізольована в `lib/coach-utils.ts` для тестування без Next.js. MongoDB через `@atleti/db` моделі.

**Tech Stack:** Next.js 14 App Router, MongoDB/Mongoose (@atleti/db), @atleti/types, @atleti/ui (GlassCard, GlassModal, Badge), Vitest + mongodb-memory-server, TDD.

---

## Команда для запуску тестів

```bash
# З директорії C:\atleti:
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web
```

---

## File Map

```
apps/web/
  app/(coach)/
    dashboard/page.tsx              ← оновити зі статистикою
    profile/page.tsx                ← форма профілю тренера
    clients/page.tsx                ← список клієнтів + запрошення
    clients/[clientId]/page.tsx     ← деталі клієнта: баланс, заняття
    calendar/page.tsx               ← місячний календар
    settings/page.tsx               ← робочі години, дедлайн, пакети

  app/api/coach/
    profile/route.ts                ← GET/PUT /api/coach/profile
    clients/route.ts                ← GET /api/coach/clients
    clients/invite/route.ts         ← POST /api/coach/clients/invite
    clients/[clientId]/route.ts     ← GET, DELETE /api/coach/clients/[id]
    clients/[clientId]/balance/route.ts  ← GET, POST /api/coach/clients/[id]/balance
    sessions/route.ts               ← GET, POST /api/coach/sessions
    sessions/[sessionId]/route.ts   ← PUT, DELETE /api/coach/sessions/[id]
    packages/route.ts               ← GET, POST /api/coach/packages
    packages/[packageId]/route.ts   ← PUT, DELETE /api/coach/packages/[id]
    settings/route.ts               ← GET, PUT /api/coach/settings

  lib/
    coach-utils.ts                  ← чиста бізнес-логіка (testable)
    session-utils.ts                ← логіка дедлайну скасування

  __tests__/api/coach/
    invite.test.ts                  ← TDD для invite API
    balance.test.ts                 ← TDD для balance API
    sessions.test.ts                ← TDD для sessions API
  __tests__/lib/
    coach-utils.test.ts             ← unit тести для бізнес-логіки
    session-utils.test.ts           ← unit тести для дедлайну
```

---

## Task 1: Бізнес-логіка — coach-utils та session-utils (TDD)

**Files:**
- Create: `apps/web/lib/coach-utils.ts`
- Create: `apps/web/lib/session-utils.ts`
- Create: `apps/web/__tests__/lib/coach-utils.test.ts`
- Create: `apps/web/__tests__/lib/session-utils.test.ts`

- [ ] **Step 1: Написати тести для coach-utils**

Файл `apps/web/__tests__/lib/coach-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { canInviteClient, getClientLimitMessage } from '../../lib/coach-utils'

describe('canInviteClient', () => {
  it('allows invite when under free plan limit', () => {
    expect(canInviteClient({ activeClients: 5, plan: 'free', clientLimit: 10 })).toBe(true)
  })

  it('blocks invite when at free plan limit', () => {
    expect(canInviteClient({ activeClients: 10, plan: 'free', clientLimit: 10 })).toBe(false)
  })

  it('allows invite on pro plan regardless of count', () => {
    expect(canInviteClient({ activeClients: 50, plan: 'pro', clientLimit: 10 })).toBe(true)
  })
})

describe('getClientLimitMessage', () => {
  it('returns correct usage string', () => {
    expect(getClientLimitMessage(3, 10)).toBe('3 / 10')
  })
})
```

- [ ] **Step 2: Написати тести для session-utils**

Файл `apps/web/__tests__/lib/session-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { canClientCancel, getSessionStatusLabel } from '../../lib/session-utils'

describe('canClientCancel', () => {
  it('allows cancel when deadline not reached', () => {
    const scheduledAt = new Date(Date.now() + 25 * 60 * 60 * 1000) // +25 hours
    expect(canClientCancel(scheduledAt, 24)).toBe(true)
  })

  it('blocks cancel when past deadline', () => {
    const scheduledAt = new Date(Date.now() + 23 * 60 * 60 * 1000) // +23 hours
    expect(canClientCancel(scheduledAt, 24)).toBe(false)
  })

  it('blocks cancel for past sessions', () => {
    const scheduledAt = new Date(Date.now() - 60 * 60 * 1000) // -1 hour
    expect(canClientCancel(scheduledAt, 24)).toBe(false)
  })
})

describe('getSessionStatusLabel', () => {
  it('maps statuses to Ukrainian labels', () => {
    expect(getSessionStatusLabel('scheduled')).toBe('Заплановано')
    expect(getSessionStatusLabel('completed')).toBe('Проведено')
    expect(getSessionStatusLabel('cancelled')).toBe('Скасовано')
  })
})
```

- [ ] **Step 3: Запустити тести — очікується FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/lib/coach-utils.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/coach-utils'`

- [ ] **Step 4: Реалізувати coach-utils.ts**

Файл `apps/web/lib/coach-utils.ts`:

```typescript
import type { CoachPlan } from '@atleti/types'

interface ClientLimitCheck {
  activeClients: number
  plan: CoachPlan
  clientLimit: number
}

export function canInviteClient({ activeClients, plan, clientLimit }: ClientLimitCheck): boolean {
  if (plan === 'pro') return true
  return activeClients < clientLimit
}

export function getClientLimitMessage(active: number, limit: number): string {
  return `${active} / ${limit}`
}
```

- [ ] **Step 5: Реалізувати session-utils.ts**

Файл `apps/web/lib/session-utils.ts`:

```typescript
import type { SessionStatus } from '@atleti/types'

export function canClientCancel(scheduledAt: Date, deadlineHours: number): boolean {
  const now = Date.now()
  const scheduled = scheduledAt.getTime()
  if (scheduled <= now) return false
  return scheduled - now > deadlineHours * 60 * 60 * 1000
}

export function getSessionStatusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    scheduled: 'Заплановано',
    completed: 'Проведено',
    cancelled: 'Скасовано',
  }
  return labels[status]
}
```

- [ ] **Step 6: Запустити всі unit тести**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/lib/
```

Expected:
```
✓ __tests__/lib/coach-utils.test.ts (3 tests)
✓ __tests__/lib/session-utils.test.ts (4 tests)
Test Files  2 passed (2)
Tests       7 passed (7)
```

- [ ] **Step 7: Коміт**

```bash
git add apps/web/lib/coach-utils.ts apps/web/lib/session-utils.ts apps/web/__tests__/lib/
git commit -m "feat: add coach and session business logic utilities"
```

---

## Task 2: Coach Profile API

**Files:**
- Create: `apps/web/app/api/coach/profile/route.ts`
- Create: `apps/web/__tests__/api/coach/profile.test.ts`

- [ ] **Step 1: Написати integration тести**

Файл `apps/web/__tests__/api/coach/profile.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: 'coach@test.com', userId: new mongoose.Types.ObjectId().toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
  })
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  await CoachProfile.ensureIndexes()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { User, CoachProfile } = await import('@atleti/db')
  await User.deleteMany({})
  await CoachProfile.deleteMany({})
})

describe('GET /api/coach/profile', () => {
  it('returns null profile if not created yet', async () => {
    const { User } = await import('@atleti/db')
    const user = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { email: 'coach@test.com', userId: user._id.toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
    } as any)

    const { GET } = await import('@/app/api/coach/profile/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile).toBeNull()
  })
})

describe('PUT /api/coach/profile', () => {
  it('creates coach profile', async () => {
    const { User } = await import('@atleti/db')
    const user = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { email: 'coach@test.com', userId: user._id.toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
    } as any)

    const { PUT } = await import('@/app/api/coach/profile/route')
    const req = new Request('http://localhost/api/coach/profile', {
      method: 'PUT',
      body: JSON.stringify({ bio: 'Тренер з 10 роками досвіду', specializations: ['fitness', 'rehab'], cancellationDeadlineHours: 24 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.bio).toBe('Тренер з 10 роками досвіду')
    expect(data.profile.cancellationDeadlineHours).toBe(24)
  })
})
```

- [ ] **Step 2: Запустити тест — FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/profile.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/coach/profile/route'`

- [ ] **Step 3: Створити route.ts**

```bash
mkdir -p apps/web/app/api/coach/profile
```

Файл `apps/web/app/api/coach/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile, User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoachUser() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function GET() {
  const user = await getCoachUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const profile = await CoachProfile.findOne({ userId: dbUser._id })
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest) {
  const user = await getCoachUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const body = await req.json()
  const { bio, specializations, cancellationDeadlineHours, workingHours } = body
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: dbUser._id },
    { bio, specializations, cancellationDeadlineHours, workingHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({ profile })
}
```

- [ ] **Step 4: Запустити тести — PASS**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/profile.test.ts
```

Expected:
```
✓ __tests__/api/coach/profile.test.ts (2 tests)
Tests  2 passed (2)
```

- [ ] **Step 5: Коміт**

```bash
git add apps/web/app/api/coach/profile apps/web/__tests__/api/coach/profile.test.ts
git commit -m "feat: add coach profile API (GET/PUT)"
```

---

## Task 3: Packages CRUD API

**Files:**
- Create: `apps/web/app/api/coach/packages/route.ts`
- Create: `apps/web/app/api/coach/packages/[packageId]/route.ts`
- Create: `apps/web/__tests__/api/coach/packages.test.ts`

- [ ] **Step 1: Написати тести**

Файл `apps/web/__tests__/api/coach/packages.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  coachId = coach._id.toString()
  await CoachProfile.create({ userId: coachId, packages: [], plan: 'free', clientLimit: 10 })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { CoachProfile } = await import('@atleti/db')
  await CoachProfile.updateOne({ userId: coachId }, { packages: [] })
})

function mockAuth() {
  vi.mock('@/lib/auth', () => ({
    auth: vi.fn().mockResolvedValue({
      user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
    })
  }))
}

describe('GET /api/coach/packages', () => {
  it('returns packages list', async () => {
    mockAuth()
    const { CoachProfile } = await import('@atleti/db')
    await CoachProfile.updateOne({ userId: coachId }, {
      packages: [{ name: 'Разове', sessions: 1, price: 900, currency: 'UAH' }]
    })
    const { GET } = await import('@/app/api/coach/packages/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.packages).toHaveLength(1)
    expect(data.packages[0].name).toBe('Разове')
  })
})

describe('POST /api/coach/packages', () => {
  it('adds a new package', async () => {
    mockAuth()
    const { POST } = await import('@/app/api/coach/packages/route')
    const req = new Request('http://localhost/api/coach/packages', {
      method: 'POST',
      body: JSON.stringify({ name: '8 тренувань', sessions: 8, price: 5600, currency: 'UAH' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.packages.some((p: any) => p.name === '8 тренувань')).toBe(true)
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/packages.test.ts
```

Expected: FAIL

- [ ] **Step 3: Створити packages/route.ts**

```bash
mkdir -p apps/web/app/api/coach/packages
```

Файл `apps/web/app/api/coach/packages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile, User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoach() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function GET() {
  const user = await getCoach()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = await CoachProfile.findOne({ userId: dbUser._id })
  return NextResponse.json({ packages: profile?.packages ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCoach()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { name, sessions, price, currency = 'UAH' } = await req.json()
  if (!name || !sessions || !price) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: dbUser._id },
    { $push: { packages: { name, sessions, price, currency } } },
    { upsert: true, new: true }
  )
  return NextResponse.json({ packages: profile.packages }, { status: 201 })
}
```

- [ ] **Step 4: Створити packages/[packageId]/route.ts**

```bash
mkdir -p "apps/web/app/api/coach/packages/[packageId]"
```

Файл `apps/web/app/api/coach/packages/[packageId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile, User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoach() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function PUT(req: NextRequest, { params }: { params: { packageId: string } }) {
  const user = await getCoach()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { name, sessions, price, currency } = await req.json()
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: dbUser._id, 'packages._id': params.packageId },
    { $set: { 'packages.$': { _id: params.packageId, name, sessions, price, currency } } },
    { new: true }
  )
  if (!profile) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  return NextResponse.json({ packages: profile.packages })
}

export async function DELETE(_req: NextRequest, { params }: { params: { packageId: string } }) {
  const user = await getCoach()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const dbUser = await User.findOne({ email: user.email })
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: dbUser._id },
    { $pull: { packages: { _id: params.packageId } } },
    { new: true }
  )
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ packages: profile.packages })
}
```

- [ ] **Step 5: Запустити тести — PASS**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/packages.test.ts
```

Expected:
```
✓ __tests__/api/coach/packages.test.ts (2 tests)
Tests  2 passed (2)
```

- [ ] **Step 6: Коміт**

```bash
git add apps/web/app/api/coach/packages apps/web/__tests__/api/coach/packages.test.ts
git commit -m "feat: add coach packages CRUD API"
```

---

## Task 4: Client Invite API + список клієнтів

**Files:**
- Create: `apps/web/app/api/coach/clients/route.ts`
- Create: `apps/web/app/api/coach/clients/invite/route.ts`
- Create: `apps/web/app/api/coach/clients/[clientId]/route.ts`
- Create: `apps/web/__tests__/api/coach/invite.test.ts`

- [ ] **Step 1: Написати TDD тести для invite**

Файл `apps/web/__tests__/api/coach/invite.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  const { ClientCoach } = await import('@atleti/db')
  await ClientCoach.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  coachId = coach._id.toString()
  await CoachProfile.create({ userId: coachId, plan: 'free', clientLimit: 10 })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { ClientCoach, User } = await import('@atleti/db')
  await ClientCoach.deleteMany({})
  await User.deleteMany({ email: { $ne: 'coach@test.com' } })
})

describe('POST /api/coach/clients/invite', () => {
  it('creates pending invite for existing client', async () => {
    const { User } = await import('@atleti/db')
    await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })

    vi.mock('@/lib/auth', () => ({
      auth: vi.fn().mockResolvedValue({
        user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
      })
    }))

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'client1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.invite.status).toBe('pending')
  })

  it('rejects invite for non-existent nickname', async () => {
    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'nobody' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })

  it('rejects invite for client who already has active coach', async () => {
    const { User, ClientCoach } = await import('@atleti/db')
    const client = await User.create({ email: 'busy@test.com', name: 'Busy', role: 'client', nickname: 'busyclient' })
    const otherCoach = await User.create({ email: 'other@test.com', name: 'Other', role: 'coach', nickname: 'othercoach' })
    await ClientCoach.create({ clientId: client._id, coachId: otherCoach._id, status: 'active' })

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'busyclient' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('вже має тренера')
  })

  it('blocks invite when coach at free plan limit', async () => {
    const { User, ClientCoach, CoachProfile } = await import('@atleti/db')
    // Set clientLimit to 1, create 1 active client
    await CoachProfile.updateOne({ userId: coachId }, { clientLimit: 1 })
    const existingClient = await User.create({ email: 'existing@test.com', name: 'Ex', role: 'client', nickname: 'existing1' })
    await ClientCoach.create({ clientId: existingClient._id, coachId, status: 'active' })

    const newClient = await User.create({ email: 'new@test.com', name: 'New', role: 'client', nickname: 'newclient1' })

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'newclient1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('ліміт')

    // Reset
    await CoachProfile.updateOne({ userId: coachId }, { clientLimit: 10 })
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/invite.test.ts
```

Expected: FAIL

- [ ] **Step 3: Створити clients/invite/route.ts**

```bash
mkdir -p apps/web/app/api/coach/clients/invite
mkdir -p "apps/web/app/api/coach/clients/[clientId]"
```

Файл `apps/web/app/api/coach/clients/invite/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, CoachProfile, ClientCoach } from '@atleti/db'
import { canInviteClient } from '@/lib/coach-utils'
import type { AtletiSession } from '@atleti/types'

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { nickname } = await req.json()
  if (!nickname) return NextResponse.json({ error: 'Nickname required' }, { status: 400 })

  await ensureDB()

  const [coachUser, clientUser] = await Promise.all([
    User.findOne({ email: coachSession.email }),
    User.findOne({ nickname: nickname.toLowerCase(), role: 'client' }),
  ])

  if (!coachUser) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
  if (!clientUser) return NextResponse.json({ error: 'Клієнта з таким нікнеймом не знайдено' }, { status: 404 })

  // Check client doesn't already have active coach
  const existingActive = await ClientCoach.findOne({ clientId: clientUser._id, status: 'active' })
  if (existingActive) {
    return NextResponse.json({ error: 'Цей клієнт вже має тренера' }, { status: 409 })
  }

  // Check coach client limit
  const profile = await CoachProfile.findOne({ userId: coachUser._id })
  const activeCount = await ClientCoach.countDocuments({ coachId: coachUser._id, status: 'active' })
  if (!canInviteClient({ activeClients: activeCount, plan: profile?.plan ?? 'free', clientLimit: profile?.clientLimit ?? 10 })) {
    return NextResponse.json({ error: `Досягнуто ліміт клієнтів (${profile?.clientLimit ?? 10})` }, { status: 403 })
  }

  // Check no pending invite already exists
  const existing = await ClientCoach.findOne({ clientId: clientUser._id, coachId: coachUser._id })
  if (existing) {
    return NextResponse.json({ error: 'Запрошення вже надіслано' }, { status: 409 })
  }

  const invite = await ClientCoach.create({
    clientId: clientUser._id,
    coachId: coachUser._id,
    status: 'pending',
  })

  return NextResponse.json({ invite }, { status: 201 })
}
```

- [ ] **Step 4: Створити clients/route.ts**

Файл `apps/web/app/api/coach/clients/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, ClientCoach, CoachProfile, Balance } from '@atleti/db'
import { getClientLimitMessage } from '@/lib/coach-utils'
import type { AtletiSession } from '@atleti/types'

export async function GET() {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [relationships, profile] = await Promise.all([
    ClientCoach.find({ coachId: coachUser._id }).populate('clientId'),
    CoachProfile.findOne({ userId: coachUser._id }),
  ])

  const activeCount = relationships.filter(r => r.status === 'active').length
  const limitMessage = getClientLimitMessage(activeCount, profile?.clientLimit ?? 10)

  return NextResponse.json({ clients: relationships, limitMessage, plan: profile?.plan ?? 'free' })
}
```

- [ ] **Step 5: Створити clients/[clientId]/route.ts**

Файл `apps/web/app/api/coach/clients/[clientId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, ClientCoach, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoach(email: string) {
  return User.findOne({ email })
}

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await getCoach(coachSession.email)
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [relationship, balance] = await Promise.all([
    ClientCoach.findOne({ clientId: params.clientId, coachId: coachUser._id }).populate('clientId'),
    Balance.findOne({ clientId: params.clientId, coachId: coachUser._id }),
  ])
  if (!relationship) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({ client: relationship, balance })
}

export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await getCoach(coachSession.email)
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Terminate relationship
  await ClientCoach.updateOne(
    { clientId: params.clientId, coachId: coachUser._id },
    { status: 'terminated' }
  )
  // Reset balance
  await Balance.updateOne(
    { clientId: params.clientId, coachId: coachUser._id },
    { sessionsTotal: 0, sessionsUsed: 0, transactions: [] }
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Запустити тести — PASS**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/invite.test.ts
```

Expected:
```
✓ __tests__/api/coach/invite.test.ts (4 tests)
Tests  4 passed (4)
```

- [ ] **Step 7: Коміт**

```bash
git add apps/web/app/api/coach/clients apps/web/__tests__/api/coach/invite.test.ts
git commit -m "feat: add coach client invite and management API"
```

---

## Task 5: Balance Management API

**Files:**
- Create: `apps/web/app/api/coach/clients/[clientId]/balance/route.ts`
- Create: `apps/web/__tests__/api/coach/balance.test.ts`

- [ ] **Step 1: Написати тести**

Файл `apps/web/__tests__/api/coach/balance.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, ClientCoach } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  await ClientCoach.create({ clientId, coachId, status: 'active' })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Balance } = await import('@atleti/db')
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/clients/[clientId]/balance', () => {
  it('tops up balance with sessions', async () => {
    const { POST } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}/balance`, {
      method: 'POST',
      body: JSON.stringify({ sessions: 8, note: '8 тренувань' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any, { params: { clientId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(8)
    expect(data.balance.sessionsRemaining).toBe(8)
    expect(data.balance.transactions).toHaveLength(1)
    expect(data.balance.transactions[0].type).toBe('topup')
  })

  it('accumulates multiple top-ups', async () => {
    const { POST } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const makeReq = (sessions: number) => new Request(`http://localhost/api/coach/clients/${clientId}/balance`, {
      method: 'POST',
      body: JSON.stringify({ sessions, note: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(makeReq(6) as any, { params: { clientId } })
    const res = await POST(makeReq(8) as any, { params: { clientId } })
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(14)
    expect(data.balance.transactions).toHaveLength(2)
  })
})

describe('GET /api/coach/clients/[clientId]/balance', () => {
  it('returns balance with sessionsRemaining', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({
      clientId, coachId, sessionsTotal: 8, sessionsUsed: 3,
      transactions: [{ type: 'topup', sessions: 8, note: 'initial', createdAt: new Date(), recordedBy: coachId }]
    })
    const { GET } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}/balance`)
    const res = await GET(req as any, { params: { clientId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(8)
    expect(data.balance.sessionsRemaining).toBe(5)
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/balance.test.ts
```

Expected: FAIL

- [ ] **Step 3: Створити balance/route.ts**

```bash
mkdir -p "apps/web/app/api/coach/clients/[clientId]/balance"
```

Файл `apps/web/app/api/coach/clients/[clientId]/balance/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

type Params = { params: { clientId: string } }

async function getCoachUser(email: string) {
  return User.findOne({ email })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await getCoachUser(coachSession.email)
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const balance = await Balance.findOne({ clientId: params.clientId, coachId: coachUser._id })
  if (!balance) return NextResponse.json({ balance: { sessionsTotal: 0, sessionsUsed: 0, sessionsRemaining: 0, transactions: [] } })

  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    }
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await getCoachUser(coachSession.email)
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { sessions, note } = await req.json()
  if (!sessions || sessions <= 0) return NextResponse.json({ error: 'Invalid sessions count' }, { status: 400 })

  const transaction = {
    type: 'topup' as const,
    sessions,
    note: note ?? '',
    createdAt: new Date(),
    recordedBy: coachUser._id,
  }

  const balance = await Balance.findOneAndUpdate(
    { clientId: params.clientId, coachId: coachUser._id },
    {
      $inc: { sessionsTotal: sessions },
      $push: { transactions: transaction },
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    }
  })
}
```

- [ ] **Step 4: Запустити — PASS**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/balance.test.ts
```

Expected:
```
✓ __tests__/api/coach/balance.test.ts (3 tests)
Tests  3 passed (3)
```

- [ ] **Step 5: Коміт**

```bash
git add "apps/web/app/api/coach/clients/[clientId]/balance" apps/web/__tests__/api/coach/balance.test.ts
git commit -m "feat: add coach balance management API"
```

---

## Task 6: Sessions API

**Files:**
- Create: `apps/web/app/api/coach/sessions/route.ts`
- Create: `apps/web/app/api/coach/sessions/[sessionId]/route.ts`
- Create: `apps/web/__tests__/api/coach/sessions.test.ts`

- [ ] **Step 1: Написати тести**

Файл `apps/web/__tests__/api/coach/sessions.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, Session } = await import('@atleti/db')
  await User.ensureIndexes()
  await Session.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Session } = await import('@atleti/db')
  await Session.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/sessions', () => {
  it('creates a session', async () => {
    const { POST } = await import('@/app/api/coach/sessions/route')
    const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const req = new Request('http://localhost/api/coach/sessions', {
      method: 'POST',
      body: JSON.stringify({ clientId, scheduledAt, duration: 60, type: 'regular' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.status).toBe('scheduled')
    expect(data.session.createdBy).toBe('coach')
  })
})

describe('PUT /api/coach/sessions/[sessionId]', () => {
  it('coach can change session status to completed', async () => {
    const { Session } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('completed')
  })

  it('coach can cancel session with reason', async () => {
    const { Session } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'client',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled', cancelReason: 'Захворів' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('cancelled')
    expect(data.session.cancelledByRole).toBe('coach')
    expect(data.session.cancelReason).toBe('Захворів')
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/sessions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Створити sessions/route.ts**

```bash
mkdir -p apps/web/app/api/coach/sessions
```

Файл `apps/web/app/api/coach/sessions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const sessions = await Session.find({
    coachId: coachUser._id,
    scheduledAt: { $gte: start, $lte: end },
  }).populate('clientId', 'name nickname avatar')

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { clientId, scheduledAt, duration = 60, type = 'regular' } = await req.json()
  if (!clientId || !scheduledAt) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const newSession = await Session.create({
    clientId,
    coachId: coachUser._id,
    scheduledAt: new Date(scheduledAt),
    duration,
    type,
    status: 'scheduled',
    createdBy: 'coach',
  })

  return NextResponse.json({ session: newSession }, { status: 201 })
}
```

- [ ] **Step 4: Створити sessions/[sessionId]/route.ts**

```bash
mkdir -p "apps/web/app/api/coach/sessions/[sessionId]"
```

Файл `apps/web/app/api/coach/sessions/[sessionId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, Session, Balance } from '@atleti/db'
import type { AtletiSession, SessionStatus } from '@atleti/types'

type Params = { params: { sessionId: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status, cancelReason } = await req.json()
  const validStatuses: SessionStatus[] = ['scheduled', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const existingSession = await Session.findOne({ _id: params.sessionId, coachId: coachUser._id })
  if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const updateData: Record<string, any> = { status }
  if (status === 'cancelled') {
    updateData.cancelledBy = coachUser._id
    updateData.cancelledByRole = 'coach'
    updateData.cancelReason = cancelReason ?? ''
  }

  // If completing a session, debit balance
  if (status === 'completed' && existingSession.status !== 'completed') {
    await Balance.findOneAndUpdate(
      { clientId: existingSession.clientId, coachId: coachUser._id },
      {
        $inc: { sessionsUsed: 1 },
        $push: {
          transactions: {
            type: 'debit',
            sessions: 1,
            note: 'Заняття проведено',
            createdAt: new Date(),
            recordedBy: coachUser._id,
          }
        }
      }
    )
  }

  const updated = await Session.findByIdAndUpdate(params.sessionId, updateData, { new: true })
  return NextResponse.json({ session: updated })
}
```

- [ ] **Step 5: Запустити — PASS**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web __tests__/api/coach/sessions.test.ts
```

Expected:
```
✓ __tests__/api/coach/sessions.test.ts (3 tests)
Tests  3 passed (3)
```

- [ ] **Step 6: Коміт**

```bash
git add apps/web/app/api/coach/sessions "apps/web/__tests__/api/coach/sessions.test.ts"
git commit -m "feat: add coach sessions API (create, status management)"
```

---

## Task 7: Settings API (робочі години + дедлайн)

**Files:**
- Create: `apps/web/app/api/coach/settings/route.ts`

- [ ] **Step 1: Створити route.ts**

```bash
mkdir -p apps/web/app/api/coach/settings
```

Файл `apps/web/app/api/coach/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET() {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = await CoachProfile.findOne({ userId: coachUser._id })
  return NextResponse.json({
    workingHours: profile?.workingHours ?? {},
    cancellationDeadlineHours: profile?.cancellationDeadlineHours ?? 24,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { workingHours, cancellationDeadlineHours } = await req.json()
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: coachUser._id },
    { workingHours, cancellationDeadlineHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({
    workingHours: profile.workingHours,
    cancellationDeadlineHours: profile.cancellationDeadlineHours,
  })
}
```

- [ ] **Step 2: Коміт**

```bash
git add apps/web/app/api/coach/settings
git commit -m "feat: add coach settings API (working hours, cancellation deadline)"
```

---

## Task 8: Coach UI — Clients Page

**Files:**
- Create: `apps/web/app/(coach)/clients/page.tsx`
- Modify: `apps/web/app/(coach)/dashboard/page.tsx`

- [ ] **Step 1: Оновити dashboard з реальними даними**

Файл `apps/web/app/(coach)/dashboard/page.tsx`:

```tsx
import { auth } from '@/lib/auth'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge } from '@atleti/ui'
import { ensureDB } from '@/lib/db'
import { User, ClientCoach, Session, CoachProfile } from '@atleti/db'
import { getClientLimitMessage } from '@/lib/coach-utils'
import Link from 'next/link'

export default async function CoachDashboard() {
  const session = await auth()
  const user = session!.user as unknown as AtletiSession
  await ensureDB()

  const coachUser = await User.findOne({ email: user.email })
  const [profile, activeClients, todaySessions] = coachUser ? await Promise.all([
    CoachProfile.findOne({ userId: coachUser._id }),
    ClientCoach.countDocuments({ coachId: coachUser._id, status: 'active' }),
    Session.countDocuments({
      coachId: coachUser._id,
      scheduledAt: { $gte: new Date(new Date().setHours(0,0,0,0)), $lte: new Date(new Date().setHours(23,59,59,999)) },
      status: 'scheduled',
    }),
  ]) : [null, 0, 0]

  const limitMessage = getClientLimitMessage(activeClients, profile?.clientLimit ?? 10)

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Вітаємо, {user.name}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard>
          <p className="text-sm text-gray-500">Клієнти</p>
          <p className="text-2xl font-bold">{limitMessage}</p>
          <Badge variant={profile?.plan === 'pro' ? 'success' : 'default'}>{profile?.plan === 'pro' ? 'Pro' : 'Free'}</Badge>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-gray-500">Заняття сьогодні</p>
          <p className="text-2xl font-bold">{todaySessions}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-gray-500">Ваш нікнейм</p>
          <p className="text-lg font-mono font-bold">@{user.nickname}</p>
        </GlassCard>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/coach/clients', label: 'Клієнти' },
          { href: '/coach/calendar', label: 'Календар' },
          { href: '/coach/settings', label: 'Налаштування' },
          { href: '/coach/profile', label: 'Профіль' },
        ].map(({ href, label }) => (
          <Link key={href} href={href}>
            <GlassCard className="text-center text-sm font-medium hover:bg-white/80 transition-colors">
              {label}
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Створити clients page**

```bash
mkdir -p apps/web/app/\(coach\)/clients
```

Файл `apps/web/app/(coach)/clients/page.tsx`:

```tsx
import { auth } from '@/lib/auth'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge, Avatar } from '@atleti/ui'
import { ensureDB } from '@/lib/db'
import { User, ClientCoach } from '@atleti/db'
import InviteClientModal from './InviteClientModal'

export default async function ClientsPage() {
  const session = await auth()
  const user = session!.user as unknown as AtletiSession
  await ensureDB()

  const coachUser = await User.findOne({ email: user.email })
  const relationships = coachUser
    ? await ClientCoach.find({ coachId: coachUser._id }).populate('clientId').sort({ invitedAt: -1 })
    : []

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
      pending: { label: 'Очікує', variant: 'warning' },
      active: { label: 'Активний', variant: 'success' },
      rejected: { label: 'Відхилено', variant: 'danger' },
      terminated: { label: 'Завершено', variant: 'default' },
    }
    return map[status] ?? { label: status, variant: 'default' }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Клієнти</h1>
        <InviteClientModal />
      </div>

      {relationships.length === 0 ? (
        <GlassCard>
          <p className="text-gray-400 text-sm text-center py-8">
            У вас ще немає клієнтів. Запросіть першого клієнта за нікнеймом.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => {
            const client = rel.clientId as any
            const badge = statusBadge(rel.status)
            return (
              <GlassCard key={rel._id.toString()}>
                <div className="flex items-center gap-3">
                  <Avatar name={client?.name ?? '?'} src={client?.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{client?.name}</p>
                    <p className="text-xs text-gray-500">@{client?.nickname}</p>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Створити InviteClientModal**

Файл `apps/web/app/(coach)/clients/InviteClientModal.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { GlassModal } from '@atleti/ui'

export default function InviteClientModal() {
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/coach/clients/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess(true)
    setTimeout(() => { setOpen(false); setSuccess(false); setNickname(''); window.location.reload() }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        + Запросити клієнта
      </button>
      <GlassModal open={open} onClose={() => setOpen(false)} title="Запросити клієнта">
        {success ? (
          <p className="text-green-600 text-sm text-center py-4">Запрошення надіслано!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">Введіть нікнейм клієнта для надсилання запрошення</p>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="нікнейм клієнта"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 border border-gray-300 rounded-md py-2 text-sm hover:bg-gray-50 transition-colors">
                Скасувати
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-gray-900 text-white rounded-md py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {loading ? 'Відправка...' : 'Запросити'}
              </button>
            </div>
          </form>
        )}
      </GlassModal>
    </>
  )
}
```

- [ ] **Step 4: Коміт**

```bash
git add apps/web/app/\(coach\)/
git commit -m "feat: add coach clients page with invite modal and updated dashboard"
```

---

## Task 9: Coach Calendar Page (місячний вигляд)

**Files:**
- Create: `apps/web/app/(coach)/calendar/page.tsx`
- Create: `apps/web/app/(coach)/calendar/CalendarClient.tsx`

- [ ] **Step 1: Створити директорію**

```bash
mkdir -p apps/web/app/\(coach\)/calendar
```

- [ ] **Step 2: Створити CalendarClient.tsx**

Файл `apps/web/app/(coach)/calendar/CalendarClient.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { GlassCard, Badge } from '@atleti/ui'
import { getSessionStatusLabel } from '@/lib/session-utils'
import type { ISession } from '@atleti/types'

interface CalendarClientProps {
  initialSessions: (ISession & { clientId: { name: string; nickname: string } })[]
  initialYear: number
  initialMonth: number
}

export default function CalendarClient({ initialSessions, initialYear, initialMonth }: CalendarClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  // Convert Sunday=0 to Monday=0 format
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  async function navigate(delta: number) {
    let newMonth = month + delta
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }
    setLoading(true)
    const res = await fetch(`/api/coach/sessions?year=${newYear}&month=${newMonth}`)
    const data = await res.json()
    setSessions(data.sessions)
    setMonth(newMonth)
    setYear(newYear)
    setSelectedDay(null)
    setLoading(false)
  }

  const sessionsByDay: Record<number, typeof sessions> = {}
  sessions.forEach(s => {
    const d = new Date(s.scheduledAt).getDate()
    if (!sessionsByDay[d]) sessionsByDay[d] = []
    sessionsByDay[d].push(s)
  })

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const monthNames = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

  const selectedSessions = selectedDay ? sessionsByDay[selectedDay] ?? [] : []

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Календар</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-gray-200 transition-colors">‹</button>
          <span className="text-sm font-medium w-36 text-center">{monthNames[month - 1]} {year}</span>
          <button onClick={() => navigate(1)} className="p-2 rounded-md hover:bg-gray-200 transition-colors">›</button>
        </div>
      </div>

      <GlassCard className="p-2">
        {/* Day names header */}
        <div className="grid grid-cols-7 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const daySessions = sessionsByDay[day] ?? []
            const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year
            const isSelected = selectedDay === day

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`
                  relative aspect-square flex flex-col items-center justify-start pt-1 rounded-md text-sm transition-colors
                  ${isToday ? 'ring-2 ring-gray-900' : ''}
                  ${isSelected ? 'bg-gray-900 text-white' : 'hover:bg-white/80'}
                `}
              >
                <span className="font-medium">{day}</span>
                {daySessions.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {daySessions.slice(0, 3).map((s, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.status === 'scheduled' ? 'bg-blue-500' :
                          s.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
                        } ${isSelected ? 'bg-white opacity-80' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* Selected day sessions */}
      {selectedDay && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">
            {selectedDay} {monthNames[month - 1]} — {selectedSessions.length === 0 ? 'немає занять' : `${selectedSessions.length} ${selectedSessions.length === 1 ? 'заняття' : 'занять'}`}
          </h2>
          {selectedSessions.map(s => {
            const client = s.clientId as any
            const time = new Date(s.scheduledAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
            return (
              <GlassCard key={s._id as string}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{time} — {client?.name ?? 'Клієнт'}</p>
                    <p className="text-xs text-gray-500">@{client?.nickname} · {s.duration} хв</p>
                  </div>
                  <Badge variant={s.status === 'scheduled' ? 'default' : s.status === 'completed' ? 'success' : 'danger'}>
                    {getSessionStatusLabel(s.status)}
                  </Badge>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {loading && <p className="text-center text-sm text-gray-400">Завантаження...</p>}
    </div>
  )
}
```

- [ ] **Step 3: Створити calendar/page.tsx**

Файл `apps/web/app/(coach)/calendar/page.tsx`:

```tsx
import { auth } from '@/lib/auth'
import type { AtletiSession } from '@atleti/types'
import { ensureDB } from '@/lib/db'
import { User, Session } from '@atleti/db'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const session = await auth()
  const user = session!.user as unknown as AtletiSession
  await ensureDB()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const coachUser = await User.findOne({ email: user.email })
  const sessions = coachUser ? await Session.find({
    coachId: coachUser._id,
    scheduledAt: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0, 23, 59, 59),
    },
  }).populate('clientId', 'name nickname avatar').lean() : []

  return (
    <CalendarClient
      initialSessions={sessions as any}
      initialYear={year}
      initialMonth={month}
    />
  )
}
```

- [ ] **Step 4: Коміт**

```bash
git add apps/web/app/\(coach\)/calendar
git commit -m "feat: add coach monthly calendar with session dots"
```

---

## Task 10: Settings і Profile pages (UI)

**Files:**
- Create: `apps/web/app/(coach)/settings/page.tsx`
- Create: `apps/web/app/(coach)/profile/page.tsx`

- [ ] **Step 1: Settings page**

```bash
mkdir -p apps/web/app/\(coach\)/settings
mkdir -p apps/web/app/\(coach\)/profile
```

Файл `apps/web/app/(coach)/settings/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { GlassCard } from '@atleti/ui'

type WorkingDay = { start: string; end: string; slotDuration: number }
type Days = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
const DAY_LABELS: Record<Days, string> = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Нд' }

export default function SettingsPage() {
  const [deadline, setDeadline] = useState(24)
  const [workingHours, setWorkingHours] = useState<Partial<Record<Days, WorkingDay>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/coach/settings')
      .then(r => r.json())
      .then(data => {
        setDeadline(data.cancellationDeadlineHours ?? 24)
        setWorkingHours(data.workingHours ?? {})
        setLoading(false)
      })
  }, [])

  function toggleDay(day: Days) {
    setWorkingHours(prev => {
      if (prev[day]) { const n = { ...prev }; delete n[day]; return n }
      return { ...prev, [day]: { start: '09:00', end: '18:00', slotDuration: 60 } }
    })
  }

  function updateDay(day: Days, field: keyof WorkingDay, value: string | number) {
    setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day]!, [field]: value } }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/coach/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours, cancellationDeadlineHours: deadline }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="pt-4 text-sm text-gray-400">Завантаження...</div>

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold">Налаштування</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <GlassCard>
          <h2 className="font-medium mb-4">Дедлайн скасування</h2>
          <label className="text-sm text-gray-600 block mb-2">
            Клієнт не може скасувати заняття менш ніж за:
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number" min={1} max={168} value={deadline}
              onChange={e => setDeadline(Number(e.target.value))}
              className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <span className="text-sm text-gray-500">годин до заняття</span>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-medium mb-4">Робочі години</h2>
          <div className="space-y-3">
            {(Object.keys(DAY_LABELS) as Days[]).map(day => {
              const active = !!workingHours[day]
              return (
                <div key={day} className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={() => toggleDay(day)}
                    className={`w-10 h-6 rounded-full transition-colors ${active ? 'bg-gray-900' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white mx-auto transition-transform ${active ? 'translate-x-2' : '-translate-x-2'}`} />
                  </button>
                  <span className="text-sm w-8">{DAY_LABELS[day]}</span>
                  {active && (
                    <>
                      <input type="time" value={workingHours[day]?.start ?? '09:00'}
                        onChange={e => updateDay(day, 'start', e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
                      <span className="text-xs text-gray-400">—</span>
                      <input type="time" value={workingHours[day]?.end ?? '18:00'}
                        onChange={e => updateDay(day, 'end', e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
                      <select value={workingHours[day]?.slotDuration ?? 60}
                        onChange={e => updateDay(day, 'slotDuration', Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white">
                        <option value={30}>30 хв</option>
                        <option value={45}>45 хв</option>
                        <option value={60}>60 хв</option>
                        <option value={90}>90 хв</option>
                      </select>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>

        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {saving ? 'Збереження...' : saved ? 'Збережено ✓' : 'Зберегти'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Profile page**

Файл `apps/web/app/(coach)/profile/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { GlassCard } from '@atleti/ui'

export default function ProfilePage() {
  const [bio, setBio] = useState('')
  const [specializations, setSpecializations] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/coach/profile')
      .then(r => r.json())
      .then(data => {
        setBio(data.profile?.bio ?? '')
        setSpecializations((data.profile?.specializations ?? []).join(', '))
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/coach/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio,
        specializations: specializations.split(',').map(s => s.trim()).filter(Boolean),
        cancellationDeadlineHours: 24,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="pt-4 text-sm text-gray-400">Завантаження...</div>

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold">Профіль</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <GlassCard>
          <label className="block text-sm font-medium mb-2">Про себе</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
            placeholder="Розкажіть про ваш досвід та підхід до тренувань"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none" />
        </GlassCard>
        <GlassCard>
          <label className="block text-sm font-medium mb-2">Спеціалізації</label>
          <input value={specializations} onChange={e => setSpecializations(e.target.value)}
            placeholder="фітнес, реабілітація, схуднення (через кому)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
        </GlassCard>
        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {saving ? 'Збереження...' : saved ? 'Збережено ✓' : 'Зберегти профіль'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Коміт**

```bash
git add apps/web/app/\(coach\)/settings apps/web/app/\(coach\)/profile
git commit -m "feat: add coach settings and profile pages"
```

---

## Task 11: Запустити всі тести та merge в stage

- [ ] **Step 1: Запустити всі тести**

```bash
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root apps/web
node node_modules/.pnpm/vitest@1.6.1_@types+node@25.7.0/node_modules/vitest/dist/cli-wrapper.js run --root packages/db
```

Expected: всі тести зелені.

- [ ] **Step 2: Merge dev → stage**

```bash
git checkout stage
git merge dev --no-ff -m "feat: coach module — clients, balance, sessions, calendar"
git checkout dev
```

---

## Self-Review

**Spec coverage:**
- ✅ Запрошення клієнта по нікнейму (invite API + UI)
- ✅ Блокування invite якщо клієнт вже має тренера
- ✅ Ліміт 10 клієнтів для Free plan
- ✅ Ручне зарахування балансу (balance API)
- ✅ Тренер зараховує баланс вручну
- ✅ Місячний календар (calendar page + API)
- ✅ Тренер може скасувати заняття в будь-який час
- ✅ Тренер може змінити статус будь-якого заняття
- ✅ Налаштування дедлайну скасування (settings API + UI)
- ✅ Сповіщення: клієнт відмовився від тренера (balance reset при terminate)
- ✅ CRUD пакетів занять (packages API)
- ✅ Профіль тренера (profile API + UI)
- ✅ Робочі години тренера (settings API)

**Не в цьому плані:**
- Client Module (бронювання клієнтом, повідомлення) → Plan 3
- Cloudflare Stream (відео) → Plan 4
- CI/CD → Plan 5
