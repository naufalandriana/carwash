'use client'

export const WIB_TZ = 'Asia/Jakarta' as const

function getWIBParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

function wibDateStringFromParts(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** YYYY-MM-DD hari ini di WIB */
export function todayWIB(d = new Date()): string {
  return wibDateStringFromParts(getWIBParts(d))
}

/** YYYY-MM-DD dari ISO/timestamp di WIB */
export function wibDateFromISO(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return wibDateStringFromParts(getWIBParts(d))
}

/** Jam 0-23 di WIB dari ISO */
export function hourWIB(iso: string): number {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return getWIBParts(d).hour
}

/** Format HH:mm WIB dari ISO */
export function formatTimeWIB(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const { hour, minute } = getWIBParts(d)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} WIB`
}

/** DD/MM/YY di WIB */
export function formatDateWIB(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TZ,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Awal hari WIB sebagai ISO dengan offset +07:00 */
export function wibDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00+07:00`
}

/** Akhir hari WIB sebagai ISO dengan offset +07:00 */
export function wibDayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59.999+07:00`
}

/** Rentang WIB untuk satu hari: [start, end] */
export function wibDayRange(dateStr: string): { start: string; end: string } {
  return { start: wibDayStart(dateStr), end: wibDayEnd(dateStr) }
}

/** 7 hari terakhir termasuk hari ini, urut naik (oldest -> today) */
export function last7DaysWIB(now = new Date()): { label: string; date: string; total: number }[] {
  const todayParts = getWIBParts(now)
  const todayMidWIB = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day)
  const result: { label: string; date: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const ms = todayMidWIB - i * 86400000
    const d = new Date(ms)
    // d is UTC midnight of that WIB date — extract WIB date again via parts from a UTC date that represents WIB midnight
    // Simpler: construct YYYY-MM-DD by offsetting from today string
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // Use a noon UTC to avoid DST edge (WIB no DST) — label via WIB weekday of that date at 07:00 UTC (= 14:00 WIB)
    const labelDate = new Date(`${dateStr}T07:00:00+07:00`)
    const label = labelDate.toLocaleDateString('id-ID', { weekday: 'short', timeZone: WIB_TZ })
    result.push({ label, date: dateStr, total: 0 })
  }
  return result
}

/** YYYY-MM dari ISO di WIB */
export function monthKeyWIB(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = getWIBParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}`
}

/** Range bulan WIB: from YYYY-MM-DD, to YYYY-MM-DD */
export function monthRangeWIB(value: string): { from: string; to: string } {
  const [y, m] = value.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from: start, to: end }
}

export function fmtDateInputWIB(d: Date): string {
  return wibDateStringFromParts(getWIBParts(d))
}
