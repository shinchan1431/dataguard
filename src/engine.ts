import type { CheckResult, DatasetSchema, IssueRow } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function checkMissing(dataset: DatasetSchema): CheckResult {
  const issues: IssueRow[] = []
  dataset.rows.forEach((row, rowIndex) => {
    dataset.columns.forEach((col) => {
      if (isMissing(row[col.key])) {
        issues.push({
          rowIndex,
          column: col.key,
          value: '',
          reason: 'Empty or null value',
        })
      }
    })
  })
  const total = dataset.rows.length * dataset.columns.length
  return {
    id: 'missing',
    title: 'Missing Values',
    severity: 'critical',
    total,
    issues: issues.length,
    passed: issues.length === 0,
    description: 'Detects null, empty, or whitespace-only cells across every column.',
    rows: issues,
  }
}

function checkDuplicates(dataset: DatasetSchema): CheckResult {
  const issues: IssueRow[] = []
  const seen = new Map<string, number[]>()
  dataset.rows.forEach((row, rowIndex) => {
    const key = dataset.columns.map((c) => stringify(row[c.key])).join('\u0001')
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(rowIndex)
  })
  seen.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((rowIndex) => {
        issues.push({
          rowIndex,
          column: '(entire row)',
          value: `Duplicate of row(s) ${indices.filter((i) => i !== rowIndex).map((i) => i + 1).join(', ')}`,
          reason: `Exact duplicate — appears ${indices.length} times`,
        })
      })
    }
  })
  return {
    id: 'duplicates',
    title: 'Duplicate Data',
    severity: 'warning',
    total: dataset.rows.length,
    issues: issues.length,
    passed: issues.length === 0,
    description: 'Flags rows that are exact duplicates of another row in the dataset.',
    rows: issues,
  }
}

function checkInvalid(dataset: DatasetSchema): CheckResult {
  const issues: IssueRow[] = []
  dataset.rows.forEach((row, rowIndex) => {
    dataset.columns.forEach((col) => {
      const value = row[col.key]
      if (isMissing(value)) return
      let reason = ''
      if (col.type === 'number') {
        if (typeof value !== 'number' || isNaN(Number(value))) reason = 'Not a valid number'
        else if (col.key === 'age' && (value as number) > 120) reason = 'Age exceeds realistic maximum (120)'
        else if (col.key === 'quantity' && (value as number) < 0) reason = 'Quantity cannot be negative'
      } else if (col.type === 'date') {
        if (!DATE_RE.test(String(value)) || isNaN(Date.parse(String(value)))) reason = 'Not a valid ISO date (YYYY-MM-DD)'
      } else if (col.type === 'boolean') {
        if (typeof value !== 'boolean') reason = 'Not a boolean'
      } else if (col.key === 'email') {
        if (!EMAIL_RE.test(String(value))) reason = 'Invalid email format'
      }
      if (reason) {
        issues.push({ rowIndex, column: col.key, value: stringify(value), reason })
      }
    })
  })
  return {
    id: 'invalid',
    title: 'Invalid Records',
    severity: 'critical',
    total: dataset.rows.length * dataset.columns.length,
    issues: issues.length,
    passed: issues.length === 0,
    description: 'Validates type constraints and domain rules (email format, age range, date format).',
    rows: issues,
  }
}

function checkDrift(dataset: DatasetSchema): CheckResult {
  const issues: IssueRow[] = []
  const numericCols = dataset.columns.filter((c) => c.type === 'number' && c.key !== 'id' && c.key !== 'order_id' && c.key !== 'customer_id')
  const half = Math.floor(dataset.rows.length / 2)
  const firstHalf = dataset.rows.slice(0, half)
  const secondHalf = dataset.rows.slice(half)

  numericCols.forEach((col) => {
    const mean = (rows: typeof dataset.rows) => {
      const vals = rows.map((r) => Number(r[col.key])).filter((v) => !isNaN(v))
      if (vals.length === 0) return 0
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }
    const m1 = mean(firstHalf)
    const m2 = mean(secondHalf)
    const shift = m2 - m1
    const pct = m1 === 0 ? 0 : (shift / Math.abs(m1)) * 100
    if (Math.abs(pct) > 15) {
      const driftRow: IssueRow = {
        rowIndex: -1,
        column: col.key,
        value: `${m1.toFixed(1)} → ${m2.toFixed(1)}`,
        reason: `Mean shifted ${pct > 0 ? '+' : ''}${pct.toFixed(0)}% between first and second half of records`,
      }
      issues.push(driftRow)
    }
  })

  return {
    id: 'drift',
    title: 'Drift Detection',
    severity: 'warning',
    total: numericCols.length,
    issues: issues.length,
    passed: issues.length === 0,
    description: 'Compares the mean of each numeric column between the first and second half of records to spot distribution drift (>15% change).',
    rows: issues,
  }
}

export function runAllChecks(dataset: DatasetSchema): CheckResult[] {
  return [checkMissing(dataset), checkDuplicates(dataset), checkInvalid(dataset), checkDrift(dataset)]
}
