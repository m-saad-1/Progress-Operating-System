import { parseISO } from 'date-fns'

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime())

export const safeParseDate = (value: unknown, fallback: Date = new Date()): Date => {
  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : new Date(fallback.getTime())
  }

  if (typeof value === 'number') {
    const numericDate = new Date(value)
    return isValidDate(numericDate) ? numericDate : new Date(fallback.getTime())
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return new Date(fallback.getTime())

    const dayKeyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dayKeyMatch) {
      const year = Number(dayKeyMatch[1])
      const month = Number(dayKeyMatch[2])
      const day = Number(dayKeyMatch[3])
      const dayKeyDate = new Date(year, month - 1, day, 0, 0, 0, 0)
      if (isValidDate(dayKeyDate)) {
        return dayKeyDate
      }
    }

    try {
      const parsedIso = parseISO(trimmed)
      if (isValidDate(parsedIso)) return parsedIso
    } catch {
      // Continue to native parsing fallback
    }

    const nativeParsed = new Date(trimmed)
    if (isValidDate(nativeParsed)) return nativeParsed
  }

  return new Date(fallback.getTime())
}

export const safeToDayKeyParts = (value: unknown): [number, number, number] | null => {
  if (typeof value !== 'string') return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return [year, month, day]
}
