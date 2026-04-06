import * as XLSX from 'xlsx'

export interface ExcelColumn {
  key: string
  header: string
  format?: 'currency' | 'number' | 'percent' | 'text' | 'date'
  width?: number // character width
}

export interface ExcelExportOptions {
  filename: string
  sheetName?: string
  columns: ExcelColumn[]
  rows: Record<string, unknown>[]
  title?: string
  subtitle?: string
}

export function exportToExcel({
  filename,
  sheetName,
  columns,
  rows,
  title,
  subtitle,
}: ExcelExportOptions): void {
  const wb = XLSX.utils.book_new()

  // Build array-of-arrays data
  const data: (string | number | null)[][] = []

  // Optional title rows
  if (title) {
    data.push([title])
    if (subtitle) data.push([subtitle])
    data.push([]) // blank separator row
  }

  // Header row
  data.push(columns.map((c) => c.header))

  // Data rows — keep numbers as numbers so Excel can format them
  for (const row of rows) {
    data.push(
      columns.map((col) => {
        const val = row[col.key]
        if (val === null || val === undefined) return null
        if (
          (col.format === 'currency' ||
            col.format === 'number') &&
          typeof val === 'number'
        ) {
          return val
        }
        if (col.format === 'percent' && typeof val === 'number') {
          // Excel native percent: pass the fractional value (e.g. 0.15 for 15%)
          return val / 100
        }
        return String(val)
      })
    )
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = columns.map((col) => ({ wch: col.width ?? 15 }))

  // Apply number format codes to every data cell (not header row)
  // headerRowIdx is 0-based index of the header row inside `data`
  const headerRowIdx = title ? (subtitle ? 3 : 2) : 0

  for (let rowIdx = headerRowIdx + 1; rowIdx < data.length; rowIdx++) {
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx]
      if (!col.format || col.format === 'text') continue

      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
      const cell = ws[cellRef]
      if (!cell) continue

      switch (col.format) {
        case 'currency':
          cell.z = '$#,##0.00'
          break
        case 'percent':
          cell.z = '0.0%'
          break
        case 'number':
          cell.z = '#,##0'
          break
        case 'date':
          cell.z = 'yyyy-mm-dd'
          break
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName ?? 'Report')

  // Append today's date to filename for traceability
  const dateSuffix = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}-${dateSuffix}.xlsx`)
}
