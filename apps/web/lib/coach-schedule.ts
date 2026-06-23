import type { ICoachBlock, DowKey, IWorkingHoursDay } from '@atleti/types'
import { parseMinutes, isDayBlocked, timeBlockConflict } from './slot-utils'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export interface ScheduleCheckResult {
  ok: boolean
  error?: string
}

// Заняття дозволене лише в межах робочого графіку дня і поза блоками тренера.
export function checkWithinSchedule(
  dayHours: IWorkingHoursDay | undefined,
  blocks: ICoachBlock[],
  date: string,
  dowKey: DowKey,
  startMin: number,
  endMin: number,
): ScheduleCheckResult {
  if (!dayHours?.start || !dayHours?.end) {
    return { ok: false, error: 'Цей день не входить до робочого графіку' }
  }
  if (startMin < parseMinutes(dayHours.start) || endMin > parseMinutes(dayHours.end)) {
    return { ok: false, error: 'Час заняття поза межами робочого графіку' }
  }
  if (isDayBlocked(blocks, date, dowKey)) {
    return { ok: false, error: 'Цей день заблокований' }
  }
  const blk = timeBlockConflict(blocks, date, dowKey, startMin, endMin)
  if (blk) {
    return { ok: false, error: `Час заблокований${blk.label ? `: ${blk.label}` : ''}` }
  }
  return { ok: true }
}

// Дата (YYYY-MM-DD), день тижня і хвилини від початку доби — усе з UTC wall-clock.
export function utcSlotParts(d: Date): { date: string; dowKey: DowKey; startMin: number } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const dowKey = DOW_KEYS[d.getUTCDay()] as DowKey
  const startMin = d.getUTCHours() * 60 + d.getUTCMinutes()
  return { date, dowKey, startMin }
}
