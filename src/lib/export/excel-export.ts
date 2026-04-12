import writeXlsxFile from 'write-excel-file/browser'
import type { SheetData, CellObject } from 'write-excel-file/browser'

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

/**
 * Export tabular data to an .xlsx file using `write-excel-file`.
 *
 * Browser-side only: triggers a download via the library's built-in file
 * save. Supports optional title/subtitle rows, typed number/currency/percent
 * formatting, and per-column character widths.
 *
 * Public API preserved from the previous `xlsx` (SheetJS) implementation so
 * call sites (src/components/shared/excel-export-button.tsx) don't need
 * changes beyond awaiting the now-async call.
 *
 * Replaces `xlsx` package which had unpatched Prototype Pollution / ReDoS
 * CVEs in its read/parse code paths (we never used those, but the package
 * flagged every audit). `write-excel-file` is write-only by design.
 */
export async function exportToExcel({
  filename,
  sheetName,
  columns,
  rows,
  title,
  subtitle,
}: ExcelExportOptions): Promise<void> {
  const data: SheetData = []

  // Optional title + subtitle rows (title is bold)
  if (title) {
    const titleCell: CellObject = { type: String, value: title, fontWeight: 'bold' }
    data.push([titleCell])
    if (subtitle) {
      const subtitleCell: CellObject = { type: String, value: subtitle }
      data.push([subtitleCell])
    }
    data.push([]) // blank separator row
  }

  // Header row — bold
  data.push(
    columns.map((c): CellObject => ({ type: String, value: c.header, fontWeight: 'bold' })),
  )

  // Data rows — typed per column.format, preserves numbers as numbers
  for (const row of rows) {
    data.push(
      columns.map((col): CellObject | null => {
        const val = row[col.key]
        if (val === null || val === undefined) return null

        if (col.format === 'currency' && typeof val === 'number') {
          return { type: Number, value: val, format: '$#,##0.00' }
        }
        if (col.format === 'number' && typeof val === 'number') {
          return { type: Number, value: val, format: '#,##0' }
        }
        if (col.format === 'percent' && typeof val === 'number') {
          // Excel native percent: pass the fractional value (0.15 → 15%)
          return { type: Number, value: val / 100, format: '0.0%' }
        }
        // 'date' cells come through as pre-formatted strings from upstream
        // (finance/payroll reports); keep as text. Same for 'text' and fallback.
        return { type: String, value: String(val) }
      }),
    )
  }

  // Per-column widths
  const columnWidths = columns.map((col) => ({ width: col.width ?? 15 }))

  // Append today's date to filename for traceability
  const dateSuffix = new Date().toISOString().slice(0, 10)

  await writeXlsxFile(data, {
    fileName: `${filename}-${dateSuffix}.xlsx`,
    sheet: sheetName ?? 'Report',
    columns: columnWidths,
  })
}
