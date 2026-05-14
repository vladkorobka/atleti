# Coach Availability & Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working hours UI and block management to the coach Calendar tab so clients see correct available slots.

**Architecture:** New `CoachBlock` MongoDB collection stores one-time and recurring time blocks. A shared `slot-utils.ts` exports pure helpers (`isDayBlocked`, `getBlockedSlots`, `getSlotBlock`) used by both the API and the UI. The existing `/api/coach/available-slots` route is extended to filter blocks. The coach Calendar tab gains a working-hours modal, a block modal, a summary bar, and an enriched day panel showing per-slot status.

**Tech Stack:** Next.js 14 App Router, TypeScript, Mongoose, Zod, Vitest + MongoMemoryServer, Tailwind CSS, `@atleti/types`, `@atleti/db`

**Spec:** `docs/superpowers/specs/2026-05-14-04-coach-availability-blocks.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `packages/types/src/index.ts` | Add `DowKey`, `ICoachBlock`, `ICoachBlockRecurring` |
| Create | `packages/db/src/schemas/coach-block.schema.ts` | Mongoose schema for CoachBlock |
| Modify | `packages/db/src/models/index.ts` | Export `CoachBlock` model |
| Create | `packages/db/src/schemas/__tests__/coach-block.schema.test.ts` | Schema unit tests |
| Modify | `apps/web/lib/slot-utils.ts` | Add block-filtering helpers |
| Create | `apps/web/__tests__/lib/slot-utils.test.ts` | Unit tests for helpers |
| Modify | `apps/web/lib/validations/coach.ts` | Add `coachBlockSchema` |
| Create | `apps/web/app/api/coach/blocks/route.ts` | GET + POST blocks |
| Create | `apps/web/app/api/coach/blocks/[blockId]/route.ts` | DELETE block |
| Create | `apps/web/__tests__/api/coach/blocks.test.ts` | API route tests |
| Modify | `apps/web/app/api/coach/available-slots/route.ts` | Filter CoachBlocks from available slots |
| Modify | `apps/web/app/coach/calendar/CalendarClient.tsx` | Full UI update |

---

## Task 1: Types + Mongoose schema + model export

**Files:**
- Modify: `packages/types/src/index.ts`
- Create: `packages/db/src/schemas/coach-block.schema.ts`
- Modify: `packages/db/src/models/index.ts`

- [ ] **Step 1: Add types**

In `packages/types/src/index.ts`, append after the last `export`:

```typescript
export type DowKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type CoachBlockType = 'time' | 'day' | 'vacation'
export type RecurringType = 'daily' | 'weekly'

export interface ICoachBlockRecurring {
  type: RecurringType
  dayOfWeek?: DowKey
  until?: string  // "2026-12-31"
}

export interface ICoachBlock {
  _id: string
  coachId: string
  type: CoachBlockType
  date?: string        // "2026-05-14" — for type='time' | 'day'
  startTime?: string   // "12:00" — for type='time'
  endTime?: string     // "13:00" — for type='time'
  dateFrom?: string    // "2026-07-01" — for type='vacation'
  dateTo?: string      // "2026-07-14" — for type='vacation'
  recurring?: ICoachBlockRecurring
  label?: string
}
```

- [ ] **Step 2: Create Mongoose schema**

Create `packages/db/src/schemas/coach-block.schema.ts`:

```typescript
import { Schema } from 'mongoose'
import type { ICoachBlock } from '@atleti/types'

const RecurringSchema = new Schema(
  {
    type: { type: String, enum: ['daily', 'weekly'], required: true },
    dayOfWeek: { type: String, enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
    until: String,
  },
  { _id: false }
)

export const CoachBlockSchema = new Schema<ICoachBlock>({
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['time', 'day', 'vacation'], required: true },
  date: String,
  startTime: String,
  endTime: String,
  dateFrom: String,
  dateTo: String,
  recurring: RecurringSchema,
  label: String,
})

CoachBlockSchema.index({ coachId: 1 })
```

- [ ] **Step 3: Export model**

In `packages/db/src/models/index.ts`, add:

```typescript
import { CoachBlockSchema } from '../schemas/coach-block.schema'
// (add alongside existing imports)

export const CoachBlock = mongoose.models.CoachBlock ?? mongoose.model('CoachBlock', CoachBlockSchema)
// (add alongside existing exports)
```

Full file after edit:

```typescript
import mongoose from 'mongoose'
import { UserSchema } from '../schemas/user.schema'
import { CoachProfileSchema } from '../schemas/coach-profile.schema'
import { ClientCoachSchema } from '../schemas/client-coach.schema'
import { BalanceSchema } from '../schemas/balance.schema'
import { SessionSchema } from '../schemas/session.schema'
import { MessageSchema } from '../schemas/message.schema'
import { ContentSchema } from '../schemas/content.schema'
import { CoachBlockSchema } from '../schemas/coach-block.schema'

export const User = mongoose.models.User ?? mongoose.model('User', UserSchema)
export const CoachProfile = mongoose.models.CoachProfile ?? mongoose.model('CoachProfile', CoachProfileSchema)
export const ClientCoach = mongoose.models.ClientCoach ?? mongoose.model('ClientCoach', ClientCoachSchema)
export const Balance = mongoose.models.Balance ?? mongoose.model('Balance', BalanceSchema)
export const Session = mongoose.models.Session ?? mongoose.model('Session', SessionSchema)
export const Message = mongoose.models.Message ?? mongoose.model('Message', MessageSchema)
export const Content = mongoose.models.Content ?? mongoose.model('Content', ContentSchema)
export const CoachBlock = mongoose.models.CoachBlock ?? mongoose.model('CoachBlock', CoachBlockSchema)
```

- [ ] **Step 4: Write failing schema tests**

Create `packages/db/src/schemas/__tests__/coach-block.schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { CoachBlock, User } from '../../models/index'

let mongod: MongoMemoryServer
let coachId: string

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await CoachBlock.ensureIndexes()
  const user = await User.create({ email: 'cb@test.com', name: 'Coach', role: 'coach', nickname: 'coachblock' })
  coachId = user._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('CoachBlock schema', () => {
  it('creates a one-time time block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'time',
      date: '2026-05-14',
      startTime: '12:00',
      endTime: '13:00',
      label: 'Обід',
    })
    expect(block.type).toBe('time')
    expect(block.startTime).toBe('12:00')
    expect(block.label).toBe('Обід')
  })

  it('creates a vacation block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'vacation',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-14',
    })
    expect(block.type).toBe('vacation')
    expect(block.dateFrom).toBe('2026-07-01')
  })

  it('creates a recurring daily time block (no date)', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'time',
      startTime: '12:00',
      endTime: '13:00',
      recurring: { type: 'daily' },
    })
    expect(block.recurring?.type).toBe('daily')
    expect(block.date).toBeUndefined()
  })

  it('creates a recurring weekly day block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'day',
      recurring: { type: 'weekly', dayOfWeek: 'sun', until: '2026-12-31' },
    })
    expect(block.recurring?.dayOfWeek).toBe('sun')
    expect(block.recurring?.until).toBe('2026-12-31')
  })

  it('requires coachId', async () => {
    await expect(
      CoachBlock.create({ type: 'day', date: '2026-05-14' })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/db && pnpm test
```

Expected: all 5 new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts packages/db/src/schemas/coach-block.schema.ts packages/db/src/models/index.ts packages/db/src/schemas/__tests__/coach-block.schema.test.ts
git commit -m "feat: add CoachBlock type, schema, and model"
```

---

## Task 2: Block-filtering helpers in slot-utils

**Files:**
- Modify: `apps/web/lib/slot-utils.ts`
- Create: `apps/web/__tests__/lib/slot-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/__tests__/lib/slot-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateSlots, isDayBlocked, getBlockedSlots, getSlotBlock } from '../../lib/slot-utils'
import type { ICoachBlock } from '@atleti/types'

describe('generateSlots', () => {
  it('generates hourly slots from 09:00 to 12:00', () => {
    expect(generateSlots('09:00', '12:00', 60)).toEqual(['09:00', '10:00', '11:00'])
  })

  it('generates 30-min slots', () => {
    expect(generateSlots('09:00', '10:00', 30)).toEqual(['09:00', '09:30'])
  })
})

const slots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00']

describe('isDayBlocked', () => {
  it('returns true for a one-time day block matching date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', date: '2026-05-14' }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(true)
  })

  it('returns false when date does not match', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', date: '2026-05-15' }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(false)
  })

  it('returns true for vacation covering the date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }]
    expect(isDayBlocked(blocks, '2026-07-07', 'tue')).toBe(true)
  })

  it('returns false for vacation not covering the date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }]
    expect(isDayBlocked(blocks, '2026-06-30', 'tue')).toBe(false)
  })

  it('returns true for recurring weekly day block on matching dow', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'weekly', dayOfWeek: 'thu' } }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(true)
  })

  it('returns false for recurring weekly block on non-matching dow', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'weekly', dayOfWeek: 'thu' } }]
    expect(isDayBlocked(blocks, '2026-05-15', 'fri')).toBe(false)
  })

  it('respects until — expired recurring block is ignored', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'daily', until: '2026-05-13' } }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(false)
  })
})

describe('getBlockedSlots', () => {
  it('blocks slots within a one-time time block range', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '14:00' }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots)).toEqual(['12:00', '13:00'])
  })

  it('does not block slots outside time block range', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00' }]
    const result = getBlockedSlots(blocks, '2026-05-14', 'thu', slots)
    expect(result).toEqual(['12:00'])
    expect(result).not.toContain('13:00')
  })

  it('handles recurring daily time block', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', startTime: '12:00', endTime: '13:00', recurring: { type: 'daily' } }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots)).toEqual(['12:00'])
  })

  it('returns empty when no blocks apply to date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-15', startTime: '12:00', endTime: '13:00' }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots)).toEqual([])
  })
})

describe('getSlotBlock', () => {
  it('returns the block that covers the given slot', () => {
    const lunch: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00', label: 'Обід' }
    expect(getSlotBlock([lunch], '12:00', '2026-05-14', 'thu')).toBe(lunch)
  })

  it('returns null when slot is not blocked', () => {
    const lunch: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00' }
    expect(getSlotBlock([lunch], '11:00', '2026-05-14', 'thu')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test __tests__/lib/slot-utils.test.ts
```

Expected: FAIL — `isDayBlocked`, `getBlockedSlots`, `getSlotBlock` not exported.

- [ ] **Step 3: Add helpers to slot-utils.ts**

Replace entire `apps/web/lib/slot-utils.ts` with:

```typescript
import type { ICoachBlock, DowKey } from '@atleti/types'

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function padTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateSlots(start: string, end: string, durationMin: number): string[] {
  const startMin = parseMinutes(start)
  const endMin = parseMinutes(end)
  const slots: string[] = []
  let current = startMin
  while (current + durationMin <= endMin) {
    slots.push(padTime(current))
    current += durationMin
  }
  return slots
}

function blockAppliesToDate(block: ICoachBlock, date: string, dowKey: DowKey): boolean {
  if (!block.recurring) {
    if (block.type === 'vacation') {
      return !!block.dateFrom && !!block.dateTo && block.dateFrom <= date && date <= block.dateTo
    }
    return block.date === date
  }
  if (block.recurring.until && date > block.recurring.until) return false
  if (block.recurring.type === 'daily') return true
  return block.recurring.type === 'weekly' && block.recurring.dayOfWeek === dowKey
}

export function isDayBlocked(blocks: ICoachBlock[], date: string, dowKey: DowKey): boolean {
  return blocks.some(b => {
    if (!blockAppliesToDate(b, date, dowKey)) return false
    return b.type === 'vacation' || b.type === 'day'
  })
}

export function getBlockedSlots(
  blocks: ICoachBlock[],
  date: string,
  dowKey: DowKey,
  slots: string[],
): string[] {
  const timeBlocks = blocks.filter(b => b.type === 'time' && blockAppliesToDate(b, date, dowKey))
  return slots.filter(slot => {
    const slotMin = parseMinutes(slot)
    return timeBlocks.some(b => {
      if (!b.startTime || !b.endTime) return false
      return slotMin >= parseMinutes(b.startTime) && slotMin < parseMinutes(b.endTime)
    })
  })
}

export function getSlotBlock(
  blocks: ICoachBlock[],
  slot: string,
  date: string,
  dowKey: DowKey,
): ICoachBlock | null {
  const slotMin = parseMinutes(slot)
  return blocks.find(b => {
    if (b.type !== 'time') return false
    if (!blockAppliesToDate(b, date, dowKey)) return false
    if (!b.startTime || !b.endTime) return false
    return slotMin >= parseMinutes(b.startTime) && slotMin < parseMinutes(b.endTime)
  }) ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test __tests__/lib/slot-utils.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/slot-utils.ts apps/web/__tests__/lib/slot-utils.test.ts
git commit -m "feat: add block-filtering helpers to slot-utils"
```

---

## Task 3: Zod validation schema for blocks

**Files:**
- Modify: `apps/web/lib/validations/coach.ts`

- [ ] **Step 1: Add `coachBlockSchema` to validations**

Append to `apps/web/lib/validations/coach.ts`:

```typescript
const recurringSchema = z.object({
  type: z.enum(['daily', 'weekly']),
  dayOfWeek: z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const coachBlockSchema = z.object({
  type: z.enum(['time', 'day', 'vacation']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().max(100).optional(),
  recurring: recurringSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'time') {
    if (!data.startTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startTime required', path: ['startTime'] })
    if (!data.endTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endTime required', path: ['endTime'] })
    if (!data.date && !data.recurring) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date or recurring required', path: ['date'] })
  }
  if (data.type === 'day' && !data.date && !data.recurring) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date or recurring required', path: ['date'] })
  }
  if (data.type === 'vacation') {
    if (!data.dateFrom) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateFrom required', path: ['dateFrom'] })
    if (!data.dateTo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateTo required', path: ['dateTo'] })
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dateFrom must be before dateTo', path: ['dateFrom'] })
    }
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/validations/coach.ts
git commit -m "feat: add coachBlockSchema validation"
```

---

## Task 4: Blocks API routes

**Files:**
- Create: `apps/web/app/api/coach/blocks/route.ts`
- Create: `apps/web/app/api/coach/blocks/[blockId]/route.ts`
- Create: `apps/web/__tests__/api/coach/blocks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/__tests__/api/coach/blocks.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachBlock } = await import('@atleti/db')
  await User.ensureIndexes()
  await CoachBlock.ensureIndexes()
  const coach = await User.create({ email: 'blocks@test.com', name: 'Coach', role: 'coach', nickname: 'coachblocks' })
  coachId = coach._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { CoachBlock } = await import('@atleti/db')
  await CoachBlock.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'blocks@test.com', userId: coachId, role: 'coach', nickname: 'coachblocks', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/blocks', () => {
  it('creates a one-time time block', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00', label: 'Обід' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.block.type).toBe('time')
    expect(data.block.startTime).toBe('12:00')
  })

  it('creates a vacation block', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.block.type).toBe('vacation')
  })

  it('rejects invalid block (missing startTime for time type)', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'time', date: '2026-05-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 401 for non-coach', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { userId: coachId, role: 'client', nickname: 'x', name: 'x', email: 'x@x.com' }
    } as any)
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'day', date: '2026-05-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/coach/blocks', () => {
  it('returns blocks for the requested month', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'day', date: '2026-05-14' })
    await CoachBlock.create({ coachId, type: 'day', date: '2026-06-01' })

    const { GET } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks?month=2026-05')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.blocks.length).toBe(1)
    expect(data.blocks[0].date).toBe('2026-05-14')
  })

  it('always includes recurring blocks', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'time', startTime: '12:00', endTime: '13:00', recurring: { type: 'daily' } })

    const { GET } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks?month=2026-05')
    const res = await GET(req as any)
    const data = await res.json()
    expect(data.blocks.some((b: any) => b.recurring?.type === 'daily')).toBe(true)
  })
})

describe('DELETE /api/coach/blocks/[blockId]', () => {
  it('deletes a block owned by the coach', async () => {
    const { CoachBlock } = await import('@atleti/db')
    const block = await CoachBlock.create({ coachId, type: 'day', date: '2026-05-14' })

    const { DELETE } = await import('@/app/api/coach/blocks/[blockId]/route')
    const req = new Request(`http://localhost/api/coach/blocks/${block._id}`)
    const res = await DELETE(req as any, { params: { blockId: block._id.toString() } })
    expect(res.status).toBe(200)

    const remaining = await CoachBlock.findById(block._id)
    expect(remaining).toBeNull()
  })

  it('returns 404 for non-existent block', async () => {
    const { DELETE } = await import('@/app/api/coach/blocks/[blockId]/route')
    const req = new Request('http://localhost/api/coach/blocks/000000000000000000000000')
    const res = await DELETE(req as any, { params: { blockId: '000000000000000000000000' } })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test __tests__/api/coach/blocks.test.ts
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Create GET + POST route**

Create `apps/web/app/api/coach/blocks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachBlock } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { coachBlockSchema } from '@/lib/validations/coach'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  }

  await ensureDB()

  const [year, m] = month.split('-').map(Number)
  const monthStart = `${year}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(year, m, 0).getDate()
  const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const blocks = await CoachBlock.find({
    coachId: coachSession.userId,
    $or: [
      { date: { $gte: monthStart, $lte: monthEnd } },
      { type: 'vacation', dateFrom: { $lte: monthEnd }, dateTo: { $gte: monthStart } },
      { recurring: { $exists: true } },
    ],
  })

  return NextResponse.json({ blocks })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = coachBlockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  await ensureDB()

  const block = await CoachBlock.create({
    coachId: coachSession.userId,
    ...parsed.data,
  })

  return NextResponse.json({ block }, { status: 201 })
}
```

- [ ] **Step 4: Create DELETE route**

Create `apps/web/app/api/coach/blocks/[blockId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachBlock } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { blockId: string } }
) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureDB()

  const result = await CoachBlock.deleteOne({
    _id: params.blockId,
    coachId: coachSession.userId,
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/web && pnpm test __tests__/api/coach/blocks.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/coach/blocks/route.ts apps/web/app/api/coach/blocks/[blockId]/route.ts apps/web/__tests__/api/coach/blocks.test.ts
git commit -m "feat: add coach blocks API (GET, POST, DELETE)"
```

---

## Task 5: Extend available-slots to filter CoachBlocks

**Files:**
- Modify: `apps/web/app/api/coach/available-slots/route.ts`

- [ ] **Step 1: Replace the route file**

Replace entire `apps/web/app/api/coach/available-slots/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile, Session, CoachBlock } from '@atleti/db'
import type { AtletiSession, ICoachBlock, DowKey } from '@atleti/types'
import { generateSlots, isDayBlocked, getBlockedSlots } from '@/lib/slot-utils'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'No active coach' }, { status: 404 })
  }
  const coachId = relationship.coachId.toString()

  const coachProfile = await CoachProfile.findOne({ userId: coachId }, 'workingHours')
  if (!coachProfile) {
    return NextResponse.json({ slots: [] })
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`)
  const dayEnd = new Date(`${date}T23:59:59.999Z`)
  const dowKey = DOW_KEYS[dayStart.getUTCDay()] as DowKey
  const dayHours = coachProfile.workingHours?.[dowKey]

  if (!dayHours?.start || !dayHours?.end || !dayHours?.slotDuration) {
    return NextResponse.json({ slots: [] })
  }

  const allSlots = generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration)

  const blocks = await CoachBlock.find({ coachId: relationship.coachId }).lean() as unknown as ICoachBlock[]

  if (isDayBlocked(blocks, date, dowKey)) {
    return NextResponse.json({ slots: [] })
  }

  const blockedSlotSet = new Set(getBlockedSlots(blocks, date, dowKey, allSlots))

  const bookedSessions = await Session.find({
    coachId: relationship.coachId,
    scheduledAt: { $gte: dayStart, $lte: dayEnd },
    status: 'scheduled',
  }).select('scheduledAt')

  const bookedTimes = new Set(
    bookedSessions.map(s => {
      const d = new Date(s.scheduledAt)
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    })
  )

  const now = new Date()
  const available = allSlots.filter(slot => {
    if (blockedSlotSet.has(slot)) return false
    if (bookedTimes.has(slot)) return false
    const [h, m] = slot.split(':').map(Number)
    const slotDate = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`)
    return slotDate > now
  })

  return NextResponse.json({ slots: available })
}
```

- [ ] **Step 2: Run full test suite to check no regressions**

```bash
cd apps/web && pnpm test
```

Expected: all existing tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/coach/available-slots/route.ts
git commit -m "feat: filter CoachBlocks from available slots"
```

---

## Task 6: Coach Calendar UI

**Files:**
- Modify: `apps/web/app/coach/calendar/CalendarClient.tsx`

This task replaces the entire `CalendarClient.tsx` with an extended version that adds:
- Working hours summary bar
- ⚙️ Робочий графік modal (set hours per day of week)
- 🚫 Заблокувати modal (add time/day/vacation block)
- Red grid indicators for fully-blocked days
- Day panel with per-slot status (free / booked / blocked)

- [ ] **Step 1: Write the new CalendarClient.tsx**

Replace entire `apps/web/app/coach/calendar/CalendarClient.tsx`:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, GlassModal, Badge } from '@atleti/ui'
import { generateSlots, isDayBlocked, getSlotBlock } from '@/lib/slot-utils'
import type { ICoachBlock, DowKey, IWorkingHoursDay } from '@atleti/types'

interface Client { id: string; name: string; nickname: string }
interface Session {
  _id: string
  clientId: string | { name: string }
  scheduledAt: string
  duration: number
  type: string
  status: string
  cancelReason?: string
}

const SESSION_TYPES = [
  { value: 'regular', label: 'Тренування' },
  { value: 'split', label: 'Спліт' },
  { value: 'online', label: 'Онлайн' },
  { value: 'consultation', label: 'Консультація' },
]

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  scheduled: { label: 'Заплановано', variant: 'warning' },
  completed: { label: 'Проведено', variant: 'success' },
  cancelled: { label: 'Скасовано', variant: 'danger' },
}

const DAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const ALL_SCHEDULE_DAYS: { key: DowKey; label: string }[] = [
  { key: 'mon', label: 'Понеділок' },
  { key: 'tue', label: 'Вівторок' },
  { key: 'wed', label: 'Середа' },
  { key: 'thu', label: 'Четвер' },
  { key: 'fri', label: 'П\'ятниця' },
  { key: 'sat', label: 'Субота' },
  { key: 'sun', label: 'Неділя' },
]

type ScheduleDay = { enabled: boolean; start: string; end: string; slotDuration: string }
type WorkingHoursMap = Partial<Record<DowKey, IWorkingHoursDay>>

function makeDefaultScheduleForm(wh: WorkingHoursMap): Record<DowKey, ScheduleDay> {
  const result = {} as Record<DowKey, ScheduleDay>
  for (const { key } of ALL_SCHEDULE_DAYS) {
    const existing = wh[key]
    result[key] = existing
      ? { enabled: true, start: existing.start, end: existing.end, slotDuration: String(existing.slotDuration) }
      : { enabled: false, start: '09:00', end: '18:00', slotDuration: '60' }
  }
  return result
}

function workingHoursSummary(wh: WorkingHoursMap): string {
  const parts: string[] = []
  for (const { key, label } of ALL_SCHEDULE_DAYS) {
    const h = wh[key]
    if (h) parts.push(`${label.slice(0, 2)} ${h.start}–${h.end} · ${h.slotDuration} хв`)
  }
  return parts.length ? parts.join(' | ') : 'Графік не налаштовано'
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarClient({ clients }: { clients: Client[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<Session[]>([])
  const [blocks, setBlocks] = useState<ICoachBlock[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>({})
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // existing modals
  const [addOpen, setAddOpen] = useState(false)
  const [statusModal, setStatusModal] = useState<Session | null>(null)
  const [editModal, setEditModal] = useState<Session | null>(null)
  const [editForm, setEditForm] = useState({ date: '', time: '', duration: '60', type: 'regular' })
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? '',
    date: '',
    time: '',
    duration: '60',
    type: 'regular',
  })
  const [statusChanging, setStatusChanging] = useState(false)

  // new modals
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<Record<DowKey, ScheduleDay>>(() =>
    makeDefaultScheduleForm({})
  )
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockForm, setBlockForm] = useState({
    type: 'time' as 'time' | 'day' | 'vacation',
    date: '',
    startTime: '',
    endTime: '',
    dateFrom: '',
    dateTo: '',
    label: '',
    recurringEnabled: false,
    recurringType: 'daily' as 'daily' | 'weekly',
    recurringDayOfWeek: 'mon' as DowKey,
    recurringUntil: '',
  })

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/coach/settings')
    if (res.ok) {
      const data = await res.json()
      setWorkingHours(data.workingHours ?? {})
    }
  }, [])

  const loadSessions = useCallback(async () => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    const [sessRes, blkRes] = await Promise.all([
      fetch(`/api/coach/sessions?month=${monthStr}`),
      fetch(`/api/coach/blocks?month=${monthStr}`),
    ])
    if (!sessRes.ok) { setError('Помилка завантаження занять'); setLoading(false); return }
    const sessData = await sessRes.json()
    setSessions(sessData.sessions ?? [])
    if (blkRes.ok) {
      const blkData = await blkRes.json()
      setBlocks(blkData.blocks ?? [])
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { loadSessions() }, [loadSessions])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function openScheduleModal() {
    setScheduleForm(makeDefaultScheduleForm(workingHours))
    setScheduleOpen(true)
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const newWorkingHours: WorkingHoursMap = {}
    for (const { key } of ALL_SCHEDULE_DAYS) {
      const d = scheduleForm[key]
      if (d.enabled) {
        newWorkingHours[key] = { start: d.start, end: d.end, slotDuration: Number(d.slotDuration) }
      }
    }
    const res = await fetch('/api/coach/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours: newWorkingHours }),
    })
    setSaving(false)
    if (!res.ok) { setError('Помилка збереження'); return }
    setWorkingHours(newWorkingHours)
    setScheduleOpen(false)
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {
      type: blockForm.type,
      label: blockForm.label || undefined,
    }
    if (blockForm.type === 'vacation') {
      body.dateFrom = blockForm.dateFrom
      body.dateTo = blockForm.dateTo
    } else {
      if (!blockForm.recurringEnabled) {
        body.date = blockForm.date
      }
      if (blockForm.type === 'time') {
        body.startTime = blockForm.startTime
        body.endTime = blockForm.endTime
      }
      if (blockForm.recurringEnabled) {
        body.recurring = {
          type: blockForm.recurringType,
          ...(blockForm.recurringType === 'weekly' ? { dayOfWeek: blockForm.recurringDayOfWeek } : {}),
          ...(blockForm.recurringUntil ? { until: blockForm.recurringUntil } : {}),
        }
      }
    }
    const res = await fetch('/api/coach/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
    setBlockOpen(false)
    await loadSessions()
  }

  async function handleDeleteBlock(blockId: string) {
    const res = await fetch(`/api/coach/blocks/${blockId}`, { method: 'DELETE' })
    if (res.ok) await loadSessions()
  }

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
    const res = await fetch('/api/coach/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: form.clientId, scheduledAt, duration: Number(form.duration), type: form.type }),
    })
    const data = await res.json()
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); setSaving(false); return }
    setAddOpen(false)
    setSaving(false)
    await loadSessions()
  }

  function openEditModal(s: Session) {
    const d = new Date(s.scheduledAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    setEditForm({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      duration: String(s.duration),
      type: s.type,
    })
    setEditModal(s)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setSaving(true)
    setError('')
    const scheduledAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString()
    const res = await fetch(`/api/coach/sessions/${editModal._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt, duration: Number(editForm.duration), type: editForm.type }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); return }
    setEditModal(null)
    await loadSessions()
  }

  async function handleStatusChange(sessionId: string, status: string) {
    setStatusChanging(true)
    const res = await fetch(`/api/coach/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setStatusChanging(false)
    if (res.ok) { setStatusModal(null); await loadSessions() }
  }

  const grid = getMonthGrid(year, month)
  const daysWithSessions = new Set(
    sessions.map(s => {
      const d = new Date(s.scheduledAt)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const selectedDaySessions = selectedDay
    ? sessions.filter(s => isSameDay(new Date(s.scheduledAt), selectedDay))
    : []

  // build slot timeline for selected day
  function buildDayTimeline() {
    if (!selectedDay) return []
    const ds = dateStr(selectedDay)
    const dowKey = DOW_KEYS[selectedDay.getDay()] as DowKey
    const dayHours = workingHours[dowKey]
    if (!dayHours) return []
    const daySlots = generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration)
    return daySlots.map(slot => {
      const [h, m] = slot.split(':').map(Number)
      const session = selectedDaySessions.find(s => {
        const sd = new Date(s.scheduledAt)
        return sd.getHours() === h && sd.getMinutes() === m
      })
      const block = getSlotBlock(blocks, slot, ds, dowKey)
      return { slot, session, block }
    })
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  const timeline = buildDayTimeline()

  return (
    <div className="space-y-4 pt-4">
      {/* Top buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={openScheduleModal}
          className="bg-white border border-gray-200 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ⚙️ Робочий графік
        </button>
        <button
          onClick={() => setBlockOpen(true)}
          className="bg-white border border-gray-200 text-gray-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          🚫 Заблокувати
        </button>
        <button
          onClick={() => setAddOpen(true)}
          disabled={clients.length === 0}
          className="ml-auto bg-gray-900 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {clients.length === 0 ? 'Немає клієнтів' : '+ Заняття'}
        </button>
      </div>

      {/* Working hours summary */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 leading-relaxed">
        {workingHoursSummary(workingHours)}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&lsaquo;</button>
        <h1 className="text-lg font-semibold text-gray-900">{MONTHS_UA[month]} {year}</h1>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600">&rsaquo;</button>
      </div>

      {/* Layout */}
      <div className="lg:flex lg:gap-4">
        {/* Calendar grid */}
        <div className="lg:flex-1">
          <GlassCard className="p-2">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_UA.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <div key={i} />
                const isToday = isSameDay(day, now)
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                const hasSessions = daysWithSessions.has(dayKey(day))
                const ds = dateStr(day)
                const dowKey = DOW_KEYS[day.getDay()] as DowKey
                const fullyBlocked = isDayBlocked(blocks, ds, dowKey)
                const isWorkingDay = !!workingHours[dowKey]
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative flex flex-col items-center py-2 rounded-md text-sm transition-colors
                      ${isSelected ? 'bg-gray-900 text-white'
                        : fullyBlocked ? 'bg-red-50 text-red-400'
                        : isToday ? 'bg-gray-100 text-gray-900 font-semibold'
                        : !isWorkingDay ? 'text-gray-300'
                        : 'text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    {day.getDate()}
                    {fullyBlocked && !isSelected && (
                      <span className="text-xs leading-none">🚫</span>
                    )}
                    {!fullyBlocked && hasSessions && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </div>

        {/* Day panel */}
        {selectedDay && (
          <div className="lg:w-72 mt-4 lg:mt-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedDay.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
              </h2>
              <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Закрити
              </button>
            </div>

            {timeline.length === 0 ? (
              <GlassCard>
                <p className="text-sm text-gray-400 text-center py-4">Не робочий день</p>
              </GlassCard>
            ) : (
              <div className="space-y-1">
                {timeline.map(({ slot, session, block }) => (
                  <GlassCard key={slot} className="py-2 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-gray-500 shrink-0">{slot}</span>
                      {block ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="text-xs text-red-500 truncate">
                            🚫 {block.label ?? 'Заблоковано'}
                            {block.recurring && <span className="ml-1 text-gray-400">(recurring)</span>}
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(block._id)}
                            className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Видалити блок"
                          >
                            ✕
                          </button>
                        </div>
                      ) : session ? (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="text-xs text-gray-700 truncate">
                            {typeof session.clientId === 'object' ? (session.clientId as any).name : '—'}
                          </span>
                          <div className="flex gap-2 shrink-0">
                            {session.status === 'scheduled' && (
                              <>
                                <button onClick={() => openEditModal(session)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                  ред.
                                </button>
                                <button onClick={() => setStatusModal(session)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                  статус
                                </button>
                              </>
                            )}
                            <Badge variant={STATUS_LABELS[session.status]?.variant ?? 'default'}>
                              {STATUS_LABELS[session.status]?.label ?? session.status}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">Вільно</span>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Working hours modal */}
      <GlassModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Робочий графік">
        <form onSubmit={handleSaveSchedule} className="space-y-3">
          {ALL_SCHEDULE_DAYS.map(({ key, label }) => {
            const d = scheduleForm[key]
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`day-${key}`}
                    checked={d.enabled}
                    onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], enabled: e.target.checked } }))}
                    className="rounded"
                  />
                  <label htmlFor={`day-${key}`} className="text-sm font-medium text-gray-700 w-28">{label}</label>
                  {d.enabled && (
                    <div className="flex gap-1 items-center text-xs text-gray-500">
                      <input
                        type="time"
                        value={d.start}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], start: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={d.end}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], end: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <input
                        type="number"
                        min="15" max="240"
                        value={d.slotDuration}
                        onChange={e => setScheduleForm(f => ({ ...f, [key]: { ...f[key], slotDuration: e.target.value } }))}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        title="Тривалість слоту (хв)"
                      />
                      <span>хв</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </form>
      </GlassModal>

      {/* Add block modal */}
      <GlassModal open={blockOpen} onClose={() => setBlockOpen(false)} title="Заблокувати час">
        <form onSubmit={handleAddBlock} className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['time', 'day', 'vacation'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setBlockForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  blockForm.type === t
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'time' ? 'Час' : t === 'day' ? 'День' : 'Відпустка'}
              </button>
            ))}
          </div>

          {blockForm.type === 'vacation' ? (
            <>
              <input type="date" required value={blockForm.dateFrom}
                onChange={e => setBlockForm(f => ({ ...f, dateFrom: e.target.value }))}
                placeholder="Від"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input type="date" required value={blockForm.dateTo}
                onChange={e => setBlockForm(f => ({ ...f, dateTo: e.target.value }))}
                placeholder="До"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </>
          ) : (
            <>
              {/* Recurring toggle */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring-toggle"
                  checked={blockForm.recurringEnabled}
                  onChange={e => setBlockForm(f => ({ ...f, recurringEnabled: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="recurring-toggle" className="text-sm text-gray-700">Повторюваний</label>
              </div>

              {blockForm.recurringEnabled ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(['daily', 'weekly'] as const).map(rt => (
                      <button key={rt} type="button"
                        onClick={() => setBlockForm(f => ({ ...f, recurringType: rt }))}
                        className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                          blockForm.recurringType === rt ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'
                        }`}
                      >
                        {rt === 'daily' ? 'Щодня' : 'Щотижня'}
                      </button>
                    ))}
                  </div>
                  {blockForm.recurringType === 'weekly' && (
                    <select value={blockForm.recurringDayOfWeek}
                      onChange={e => setBlockForm(f => ({ ...f, recurringDayOfWeek: e.target.value as DowKey }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                    >
                      {ALL_SCHEDULE_DAYS.map(({ key, label }) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  )}
                  <input type="date" value={blockForm.recurringUntil}
                    onChange={e => setBlockForm(f => ({ ...f, recurringUntil: e.target.value }))}
                    placeholder="До дати (необов'язково)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              ) : (
                <input type="date" required value={blockForm.date}
                  onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              )}

              {blockForm.type === 'time' && (
                <div className="flex gap-2">
                  <input type="time" required value={blockForm.startTime}
                    onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                  <span className="self-center text-gray-400">–</span>
                  <input type="time" required value={blockForm.endTime}
                    onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              )}
            </>
          )}

          <input type="text" value={blockForm.label}
            onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Назва (необов'язково)"
            maxLength={100}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Заблокувати'}
          </button>
        </form>
      </GlassModal>

      {/* Add session modal */}
      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Нове заняття">
        <form onSubmit={handleAddSession} className="space-y-3">
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} (@{c.nickname})</option>)}
          </select>
          <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <input type="time" required value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="15" max="480" value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="Тривалість (хв)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
              {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Додати заняття'}
          </button>
        </form>
      </GlassModal>

      {/* Status change modal */}
      {statusModal && (
        <GlassModal open={true} onClose={() => setStatusModal(null)} title="Статус заняття">
          <div className="space-y-2">
            <button onClick={() => handleStatusChange(statusModal._id, 'completed')} disabled={statusChanging}
              className={`w-full border border-green-300 text-green-700 rounded-md py-2.5 text-sm font-medium hover:bg-green-50 transition-colors${statusChanging ? ' opacity-50' : ''}`}>
              Позначити як проведене
            </button>
            <button onClick={() => handleStatusChange(statusModal._id, 'cancelled')} disabled={statusChanging}
              className={`w-full border border-red-300 text-red-700 rounded-md py-2.5 text-sm font-medium hover:bg-red-50 transition-colors${statusChanging ? ' opacity-50' : ''}`}>
              Скасувати заняття
            </button>
          </div>
        </GlassModal>
      )}

      {/* Edit session modal */}
      {editModal && (
        <GlassModal open={true} onClose={() => { setEditModal(null); setError('') }} title="Редагувати заняття">
          <form onSubmit={handleEdit} className="space-y-3">
            <input type="date" required value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <input type="time" required value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="15" max="480" required value={editForm.duration}
                onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))}
                placeholder="Тривалість (хв)"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </form>
        </GlassModal>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd apps/web && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Start dev server and manually verify**

```bash
pnpm dev
```

Check in browser at `http://localhost:3000/coach/calendar`:
1. "⚙️ Робочий графік" button opens modal with 7 days — set Пн–Пт 09:00–18:00 · 60 хв, save → summary bar updates
2. "🚫 Заблокувати" → block type "Час" → date 14 травня, 12:00–13:00, label "Обід" → save → calendar day shows no red (it's a time block, not a full day)
3. Select 14 травня in grid → day panel shows slots: 09:00 Вільно, ..., 12:00 🚫 Обід (з кнопкою ✕), 13:00 Вільно, ...
4. "🚫 Заблокувати" → type "День" → date 15 травня → save → cell 15 shows red + 🚫
5. As client, navigate to `/client/sessions` → select date 14 травня → slot 12:00 should NOT appear in available slots

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/coach/calendar/CalendarClient.tsx
git commit -m "feat: add working hours UI, block modal, and slot timeline to coach calendar"
```

---

## Self-review

**Spec coverage:**
- ✅ Working hours UI: ⚙️ modal in Calendar tab
- ✅ Working hours summary bar below buttons
- ✅ Block types: time / day / vacation
- ✅ Recurring blocks: daily and weekly with optional until
- ✅ Calendar grid: red + 🚫 for fully blocked days
- ✅ Day panel: per-slot status (free / booked / blocked) with delete button for blocks
- ✅ available-slots filters CoachBlocks before returning to client
- ✅ No changes needed to ClientCalendar.tsx

**No placeholders:** all steps contain actual code.

**Type consistency:** `ICoachBlock`, `DowKey`, `IWorkingHoursDay` defined in Task 1, used consistently in Tasks 2–6. `getSlotBlock` defined and exported in Task 2, imported in CalendarClient in Task 6.
