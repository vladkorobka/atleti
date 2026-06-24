import type { ICoachBlock, DowKey } from '@atleti/types'

export function parseMinutes(time: string): number {
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
  slotDurationMin: number,
): string[] {
  const timeBlocks = blocks.filter(b => b.type === 'time' && blockAppliesToDate(b, date, dowKey))
  return slots.filter(slot => {
    const slotMin = parseMinutes(slot)
    return timeBlocks.some(b => {
      if (!b.startTime || !b.endTime) return false
      return slotMin < parseMinutes(b.endTime) && (slotMin + slotDurationMin) > parseMinutes(b.startTime)
    })
  })
}

export function getSlotBlock(
  blocks: ICoachBlock[],
  slot: string,
  date: string,
  dowKey: DowKey,
  slotDurationMin: number,
): ICoachBlock | null {
  const slotMin = parseMinutes(slot)
  return blocks.find(b => {
    if (b.type !== 'time') return false
    if (!blockAppliesToDate(b, date, dowKey)) return false
    if (!b.startTime || !b.endTime) return false
    return slotMin < parseMinutes(b.endTime) && (slotMin + slotDurationMin) > parseMinutes(b.startTime)
  }) ?? null
}

// Усі time-блоки, що застосовуються до дати (для агенди дня).
export function getTimeBlocksForDate(blocks: ICoachBlock[], date: string, dowKey: DowKey): ICoachBlock[] {
  return blocks.filter(b => b.type === 'time' && blockAppliesToDate(b, date, dowKey))
}

// Чи перетинає інтервал [startMin, endMin) якийсь time-блок дати (напіввідкриті інтервали).
export function timeBlockConflict(
  blocks: ICoachBlock[],
  date: string,
  dowKey: DowKey,
  startMin: number,
  endMin: number,
): ICoachBlock | null {
  return getTimeBlocksForDate(blocks, date, dowKey).find(b => {
    if (!b.startTime || !b.endTime) return false
    return startMin < parseMinutes(b.endTime) && parseMinutes(b.startTime) < endMin
  }) ?? null
}
