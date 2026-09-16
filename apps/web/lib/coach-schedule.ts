import type { ICoachBlock, DowKey, IWorkingHoursDay } from '@atleti/types'
import { parseMinutes, isDayBlocked, timeBlockConflict } from './slot-utils'
import { kyivSlotParts } from './tz'

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

// Дата (YYYY-MM-DD), день тижня і хвилини від початку доби — у київському поясі.
// (Заняття зберігаються як справжній UTC, тож настінний час беремо через kyivSlotParts.)
export const slotParts = kyivSlotParts
