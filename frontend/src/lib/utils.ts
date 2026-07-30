import { clsx, type ClassValue } from 'clsx'
import { format } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeCurrencyCode(currency: string): string {
  const trimmed = currency.trim().toUpperCase()
  const numericMap: Record<string, string> = {
    '840': 'USD',
    '356': 'INR',
    '978': 'EUR',
    '826': 'GBP',
    '392': 'JPY',
    '036': 'AUD',
    '124': 'CAD',
    '784': 'AED',
    '682': 'SAR',
  }

  if (numericMap[trimmed]) return numericMap[trimmed]
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed
  return 'USD'
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const code = normalizeCurrencyCode(currency)
  const locale = code === 'INR' ? 'en-IN' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function downloadCsv(
  rows: Record<string, string | number | boolean | null | undefined>[],
  filename: string,
): void {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const escapeCell = (value: string | number | boolean | null | undefined): string => {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
