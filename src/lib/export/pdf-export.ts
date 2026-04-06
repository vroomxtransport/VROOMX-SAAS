import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ============================================================================
// Types
// ============================================================================

export interface PdfColumn {
  key: string
  header: string
  format?: 'currency' | 'number' | 'percent' | 'text'
  align?: 'left' | 'center' | 'right'
}

export interface PdfSummaryCard {
  label: string
  value: string
}

export interface PdfExportOptions {
  filename: string
  title: string
  subtitle?: string
  columns: PdfColumn[]
  rows: Record<string, unknown>[]
  orientation?: 'portrait' | 'landscape'
  /** Optional summary cards rendered above the data table */
  summaryCards?: PdfSummaryCard[]
  /** Footer text shown on every page beside the page number */
  footer?: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatPdfValue(value: unknown, format?: PdfColumn['format']): string {
  if (value === null || value === undefined) return '\u2014'

  if (format === 'text' || format === undefined) return String(value)

  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num)
    case 'percent':
      return `${num.toFixed(1)}%`
    case 'number':
      return num.toLocaleString('en-US')
  }
}

function drawSummaryCards(
  doc: jsPDF,
  cards: PdfSummaryCard[],
  startY: number,
  pageWidth: number
): number {
  const cardCount = cards.length
  const totalGap = (cardCount - 1) * 4
  const cardWidth = (pageWidth - 28 - totalGap) / cardCount
  const cardHeight = 18

  for (let i = 0; i < cardCount; i++) {
    const card = cards[i]
    const x = 14 + i * (cardWidth + 4)

    doc.setFillColor(245, 246, 248)
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110, 110, 110)
    doc.text(card.label.toUpperCase(), x + 5, startY + 6.5)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(25, 35, 52)
    doc.text(card.value, x + 5, startY + 14)
  }

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)

  return startY + cardHeight + 7
}

// ============================================================================
// Main export function
// ============================================================================

export function exportToPdf(options: PdfExportOptions): void {
  const { filename, title, subtitle, columns, rows, orientation, summaryCards, footer } = options

  const doc = new jsPDF({
    orientation: orientation ?? 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(25, 35, 52)
  doc.text(title, 14, yPos)
  yPos += 7

  // Subtitle
  if (subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(subtitle, 14, yPos)
    yPos += 5
  }

  // Date stamp
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 160, 160)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`,
    14,
    yPos
  )
  doc.setTextColor(0)
  yPos += 8

  // Summary cards
  if (summaryCards && summaryCards.length > 0) {
    yPos = drawSummaryCards(doc, summaryCards, yPos, pageWidth)
  }

  // Separator
  doc.setDrawColor(220, 222, 226)
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 5

  // Build table data
  const tableHead: string[][] = [columns.map((c) => c.header)]
  const tableBody: string[][] = rows.map((row) =>
    columns.map((col) => formatPdfValue(row[col.key], col.format))
  )

  // Column alignment: right-align numeric formats unless caller specifies otherwise
  const columnStyles: Record<number, { halign: 'left' | 'center' | 'right' }> = {}
  columns.forEach((col, idx) => {
    const isNumeric =
      col.format === 'currency' || col.format === 'number' || col.format === 'percent'
    const halign = col.align ?? (isNumeric ? 'right' : 'left')
    if (halign !== 'left') {
      columnStyles[idx] = { halign }
    }
  })

  autoTable(doc, {
    startY: yPos,
    head: tableHead,
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [25, 35, 52],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      cellPadding: { top: 3, right: 5, bottom: 3, left: 5 },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(170, 170, 170)
      doc.text(footer ?? 'VroomX TMS', 14, pageHeight - 10)
      doc.text(`Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 10, {
        align: 'right',
      })
      doc.setTextColor(0)
    },
  })

  doc.save(`${filename}.pdf`)
}
