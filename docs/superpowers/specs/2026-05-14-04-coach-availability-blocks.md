# Coach Availability & Blocks — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

## Problem

Clients see "no available slots" even when the coach has no sessions scheduled, because the coach has no working hours configured. There is also no UI for coaches to set working hours or block personal time.

## Concept

A **slot** is a time interval generated from the coach's working hours template. A slot is **available** when:
1. It falls within the coach's `workingHours` for that day of the week
2. No `Session` exists at that time (already implemented)
3. No `CoachBlock` covers that slot

## Data Model

### Existing: `CoachProfile.workingHours`
Already exists. Per-day-of-week: `{ start, end, slotDuration }`. No schema changes needed — only UI to set it.

### New: `CoachBlock` collection

```ts
{
  coachId:   ObjectId  // ref: User

  type: 'time' | 'day' | 'vacation'

  // one-time: type='time' or type='day'
  date?: string        // "2026-05-14"
  startTime?: string   // "12:00" — only for type='time'
  endTime?: string     // "13:00" — only for type='time'

  // multi-day: type='vacation'
  dateFrom?: string    // "2026-07-01"
  dateTo?: string      // "2026-07-14"

  // optional recurring rule
  recurring?: {
    type: 'daily' | 'weekly'
    dayOfWeek?: 'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'  // only for 'weekly', matches existing DOW_KEYS convention
    until?: string  // "2026-12-31"
  }

  label?: string       // "Обід", "Відпустка", etc.
}
```

Index: `{ coachId: 1 }`.

A recurring block without `date` applies by rule alone. Example — daily lunch 12:00–13:00:
```json
{ "type": "time", "startTime": "12:00", "endTime": "13:00", "recurring": { "type": "daily" } }
```

## API

### Working hours (existing endpoint, new UI)
```
PATCH /api/coach/settings   { workingHours: { mon: {start,end,slotDuration}, ... } }
```

### Blocks (new)
```
GET    /api/coach/blocks?month=2026-05   → blocks for month (one-time + recurring in range)
POST   /api/coach/blocks                 → create block
DELETE /api/coach/blocks/[blockId]       → delete block
```

### Available slots (extend existing logic)
```
GET /api/coach/available-slots?date=YYYY-MM-DD
```

Extended algorithm:
1. Load `workingHours` for day-of-week → generate all slots
2. Load `CoachBlock` for `coachId`:
   - `type:'day'` matching `date` → return `[]`
   - `type:'vacation'` where `dateFrom <= date <= dateTo` → return `[]`
   - recurring `type:'day'` matching day → return `[]`
   - `type:'time'` one-time matching `date` → exclude overlapping slots
   - `type:'time'` recurring daily, or weekly with matching `dayOfWeek` → exclude overlapping slots
   - Check `until` — skip if `date > until`
3. Filter out booked `Session` times (existing)
4. Filter out past slots (existing)

## UI — Coach Calendar Tab

### Top bar (3 buttons)
- **⚙️ Робочий графік** — opens modal to configure working hours per day (mon–sun: start, end, slotDuration, or "не працює")
- **🚫 Заблокувати** — opens modal to add a block (type selector: час / день / відпустка, date/range, optional label, optional recurring)
- **+ Додати заняття** — existing functionality

### Working hours summary bar
Below top buttons: compact read-only line showing current schedule, e.g. "Пн–Пт 09:00–18:00 · 60 хв | Сб 10:00–15:00 · 60 хв | Нд — вихідний"

### Calendar grid
- Days with sessions: amber dot indicator (existing)
- Days fully blocked: red background + 🚫 icon
- Days that are off (not in workingHours): muted text

### Day panel (when a day is selected)
Shows time-slot list for that day:
- 🟢 Вільно
- 🟡 Client name · Session type
- 🔴 🚫 Block label (+ "recurring" badge if applicable), with delete button

## Client side

No changes to `ClientCalendar.tsx`. Once the coach sets working hours and blocks, `/api/coach/available-slots` returns correct data automatically.

## Out of scope

- Recurring exceptions (e.g., "skip this one occurrence of a recurring block")
- Multiple working-hour ranges per day (e.g., split shift 9–12 + 14–18)
- Client-visible block labels
