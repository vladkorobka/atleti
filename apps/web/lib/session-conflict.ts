// Логіка заборони подвійного бронювання тренера.
// Два заняття на той самий час неможливі, ОКРІМ випадку Спліт:
// поверх Спліт-заняття можна поставити інше заняття лише з типом Спліт.

export interface SessionInterval {
  scheduledAt: Date | string
  duration: number // хвилини
  type: string
}

const MS_PER_MIN = 60_000

// Напіввідкриті інтервали [aStart, aEnd) та [bStart, bEnd).
// Стик впритул (aEnd === bStart) НЕ вважається перетином.
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

// Чи блокує новий слот існуючі заняття.
// true → конфлікт (створення/перенос заборонено).
export function hasBlockingConflict(
  newStart: Date,
  newDurationMin: number,
  newType: string,
  existing: SessionInterval[],
): boolean {
  const aStart = newStart.getTime()
  const aEnd = aStart + newDurationMin * MS_PER_MIN

  const overlapping = existing.filter(s => {
    const bStart = new Date(s.scheduledAt).getTime()
    const bEnd = bStart + s.duration * MS_PER_MIN
    return intervalsOverlap(aStart, aEnd, bStart, bEnd)
  })

  if (overlapping.length === 0) return false

  // Дозволено лише якщо нове заняття Спліт І всі перетнуті теж Спліт
  const allSplit = newType === 'split' && overlapping.every(s => s.type === 'split')
  return !allSplit
}

// Максимальна тривалість заняття (хв) — межа вікна вибірки кандидатів на перетин.
export const MAX_SESSION_DURATION_MIN = 480
