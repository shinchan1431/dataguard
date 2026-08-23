export type ColumnType = 'string' | 'number' | 'date' | 'boolean'

export interface DatasetRow {
  [key: string]: string | number | boolean | null
}

export interface DatasetSchema {
  name: string
  columns: { key: string; type: ColumnType }[]
  rows: DatasetRow[]
}

export type CheckId = 'missing' | 'duplicates' | 'invalid' | 'drift'

export type Severity = 'critical' | 'warning' | 'info'

export interface IssueRow {
  rowIndex: number
  column: string
  value: string
  reason: string
}

export interface CheckResult {
  id: CheckId
  title: string
  severity: Severity
  total: number
  issues: number
  passed: boolean
  description: string
  rows: IssueRow[]
}
