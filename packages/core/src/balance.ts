// Похідні від балансу. Правила однакові для клієнтських екранів і для API, тож
// живуть в одному місці — інакше три копії формули розійдуться при першій же зміні.

interface BalanceCounts {
  sessionsTotal: number
  sessionsUsed: number
}

// Борг: проведених занять більше, ніж оплачених. Виникає, коли тренер записує
// проведене заняття заднім числом при вичерпаному балансі.
// Резерв (заплановані заняття) свідомо не враховується — резерв це ще не борг.
export function sessionsDebt(b: BalanceCounts): number {
  return Math.max(0, b.sessionsUsed - b.sessionsTotal)
}

// Доступно для бронювання: оплачені мінус проведені мінус заплановані.
// Клемпимо в нуль — від'ємне «доступно» не має сенсу, борг показується окремо.
export function sessionsAvailable(b: BalanceCounts, reserved: number): number {
  return Math.max(0, b.sessionsTotal - b.sessionsUsed - reserved)
}

// Українська множина: 1 заняття, 2-4 заняття, 5-20 занять, 21 заняття, 25 занять.
export function pluralSessions(n: number): string {
  const mod100 = Math.abs(n) % 100
  const mod10 = Math.abs(n) % 10
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заняття'
  if (mod10 === 1 && mod100 !== 11) return 'заняття'
  return 'занять'
}
