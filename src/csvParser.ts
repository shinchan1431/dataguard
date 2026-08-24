import Papa from 'papaparse'
import type { ColumnType, DatasetRow, DatasetSchema } from './types'

function isMissing(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function isBooleanValue(value: string): boolean {
  return ['true', 'false', 'yes', 'no'].includes(value.trim().toLowerCase())
}

function isNumberValue(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value))
}

function isDateValue(value: string): boolean {
  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false
  }

  return !Number.isNaN(Date.parse(trimmed))
}

function detectColumnType(values: unknown[]): ColumnType {
  const nonEmpty = values
    .filter((value) => !isMissing(value))
    .map((value) => String(value).trim())

  if (nonEmpty.length === 0) {
    return 'string'
  }

  if (nonEmpty.every(isBooleanValue)) {
    return 'boolean'
  }

  if (nonEmpty.every(isNumberValue)) {
    return 'number'
  }

  if (nonEmpty.every(isDateValue)) {
    return 'date'
  }

  return 'string'
}

function convertValue(
  value: unknown,
  type: ColumnType
): string | number | boolean | null {
  if (isMissing(value)) {
    return null
  }

  const text = String(value).trim()

  if (type === 'number') {
    return Number(text)
  }

  if (type === 'boolean') {
    return ['true', 'yes'].includes(text.toLowerCase())
  }

  return text
}

export function parseCsvFile(file: File): Promise<DatasetSchema> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,

      transformHeader: (header) => header.trim(),

      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message))
          return
        }

        const rows = results.data
        const headers = results.meta.fields ?? []

        if (headers.length === 0) {
          reject(new Error('The CSV file does not contain any columns.'))
          return
        }

        const columns = headers.map((key) => ({
          key,
          type: detectColumnType(rows.map((row) => row[key])),
        }))

        const convertedRows: DatasetRow[] = rows.map((row) => {
          const converted: DatasetRow = {}

          columns.forEach((column) => {
            converted[column.key] = convertValue(
              row[column.key],
              column.type
            )
          })

          return converted
        })

        resolve({
          name: file.name,
          columns,
          rows: convertedRows,
        })
      },

      error: (error) => {
        reject(error)
      },
    })
  })
}
