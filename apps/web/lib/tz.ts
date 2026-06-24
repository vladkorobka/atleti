// Канонічний часовий пояс застосунку. Зберігаємо UTC в БД, ввід і показ — у Києві.
export const APP_TZ = 'Europe/Kyiv'

const pad = (n: number) => String(n).padStart(2, '0')

export interface KyivParts {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
}

// Складові настінного часу в Києві для заданого моменту.
export function kyivParts(date: Date): KyivParts {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value])) as Record<string, string>
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  }
}

// Зсув київського поясу (мс) для моменту: kyivWall(date) - utc(date).
function kyivOffsetMs(date: Date): number {
  const p = kyivParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  // обрізаємо date до хвилин, щоб не ловити секунди
  const base = Math.floor(date.getTime() / 60000) * 60000
  return asUtc - base
}

// UTC-момент із настінного часу в Києві. Two-pass для стабільності біля переходів DST.
export function kyivWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute)
  // перша оцінка зсуву за наївним моментом
  let offset = kyivOffsetMs(new Date(naiveUtc))
  let utc = naiveUtc - offset
  // друга ітерація: уточнюємо зсув уже за скоригованим моментом
  const offset2 = kyivOffsetMs(new Date(utc))
  if (offset2 !== offset) {
    offset = offset2
    utc = naiveUtc - offset
  }
  return new Date(utc)
}

// З "YYYY-MM-DD" + "HH:mm" (настінний київський час) у UTC Date.
export function kyivInputToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  return kyivWallTimeToUtc(y, mo, d, h, mi)
}

// Відображення моменту в київському поясі.
export function formatKyiv(date: Date | string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString('uk-UA', { ...opts, timeZone: APP_TZ })
}

// "YYYY-MM-DD" у Києві — для value/min полів <input type="date">.
export function kyivDateInput(date: Date): string {
  const p = kyivParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

// "HH:mm" у Києві — для <input type="time">.
export function kyivTimeInput(date: Date): string {
  const p = kyivParts(date)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type SlotDowKey = (typeof DOW_KEYS)[number]

// Дата (YYYY-MM-DD), день тижня і хвилини від початку доби — усе в київському поясі.
// Заняття зберігаються як справжній UTC, тож настінний час дістаємо через kyivParts.
export function kyivSlotParts(d: Date): { date: string; dowKey: SlotDowKey; startMin: number } {
  const p = kyivParts(d)
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`
  // день тижня саме київської календарної дати
  const dowKey = DOW_KEYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()] as SlotDowKey
  const startMin = p.hour * 60 + p.minute
  return { date, dowKey, startMin }
}
