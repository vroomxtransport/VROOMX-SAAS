import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PnLOutput, UnitMetrics } from '@/lib/financial/pnl-calculations'

// ============================================================================
// Types
// ============================================================================

export interface PnLPdfOptions {
  pnl: PnLOutput
  periodLabel: string // e.g. "April 2026 MTD"
  companyName?: string
  /** Optional per-unit metrics appended as a second section */
  unitMetrics?: UnitMetrics
}

// ============================================================================
// Helpers
// ============================================================================

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const PCT = (n: number) => `${n.toFixed(1)}%`
const NUM = (n: number) => n.toLocaleString('en-US')

function fmt(value: number | null, type: 'currency' | 'percent' | 'number'): string {
  if (value === null) return '\u2014'
  switch (type) {
    case 'currency':
      return USD.format(value)
    case 'percent':
      return PCT(value)
    case 'number':
      return NUM(value)
  }
}

type LineItem = {
  label: string
  value: string
  /** Indentation level: 0 = section header, 1 = line item, 2 = sub-item */
  indent?: 0 | 1 | 2
  /** Visual treatment */
  style?: 'header' | 'subtotal' | 'total' | 'divider' | 'normal'
}

// ============================================================================
// Line-item builder
// ============================================================================

function buildPnLLines(pnl: PnLOutput): LineItem[] {
  const lines: LineItem[] = []

  const push = (
    label: string,
    value: string,
    indent: LineItem['indent'] = 1,
    style: LineItem['style'] = 'normal'
  ) => lines.push({ label, value, indent, style })

  const divider = () => lines.push({ label: '', value: '', indent: 0, style: 'divider' })

  // Revenue waterfall
  push('REVENUE', '', 0, 'header')
  push('Total Revenue', fmt(pnl.revenue, 'currency'))
  push('  Broker Fees', `(${fmt(pnl.brokerFees, 'currency')})`, 2)
  push('  Local Fees', `(${fmt(pnl.localFees, 'currency')})`, 2)
  push('Clean Gross', fmt(pnl.cleanGross, 'currency'), 1, 'subtotal')

  divider()

  push('DRIVER COSTS', '', 0, 'header')
  push('Driver Pay', `(${fmt(pnl.driverPay, 'currency')})`, 1)
  push('Truck Gross', fmt(pnl.truckGross, 'currency'), 1, 'subtotal')
  push('Gross Profit Margin', PCT(pnl.grossProfitMargin), 2)

  divider()

  push('OPERATING EXPENSES', '', 0, 'header')
  push('Fixed Costs', fmt(pnl.fixedCosts, 'currency'))

  // Fixed cost sub-categories (if any)
  const cats = Object.entries(pnl.fixedCostsByCategory)
  for (const [cat, amount] of cats) {
    const label = `  ${cat.charAt(0).toUpperCase()}${cat.slice(1).replace(/_/g, ' ')}`
    push(label, fmt(amount, 'currency'), 2)
  }

  push('Direct Trip Costs', fmt(pnl.directTripCosts, 'currency'))
  push('  Fuel', fmt(pnl.fuelCosts, 'currency'), 2)
  push('  Tolls', fmt(pnl.tollCosts, 'currency'), 2)
  push('  Maintenance', fmt(pnl.maintenanceCosts, 'currency'), 2)
  push('  Lodging', fmt(pnl.lodgingCosts, 'currency'), 2)
  push('  Miscellaneous', fmt(pnl.miscCosts, 'currency'), 2)

  if (pnl.carrierPay > 0) {
    push('Carrier Pay', fmt(pnl.carrierPay, 'currency'))
  }

  push('Total Operating Expenses', fmt(pnl.totalOperatingExpenses, 'currency'), 1, 'subtotal')

  divider()

  push('BOTTOM LINE', '', 0, 'header')
  push('Net Profit Before Tax', fmt(pnl.netProfitBeforeTax, 'currency'), 1, 'total')
  push('Net Margin', PCT(pnl.netMargin), 2)

  if (pnl.breakEvenRevenue !== null) {
    push('Break-Even Revenue', fmt(pnl.breakEvenRevenue, 'currency'), 2)
  }

  return lines
}

function buildUnitMetricLines(u: UnitMetrics): LineItem[] {
  const lines: LineItem[] = []

  const push = (
    label: string,
    value: string,
    indent: LineItem['indent'] = 1,
    style: LineItem['style'] = 'normal'
  ) => lines.push({ label, value, indent, style })

  const divider = () => lines.push({ label: '', value: '', indent: 0, style: 'divider' })

  push('VOLUME', '', 0, 'header')
  push('Trucks in Service', fmt(u.trucksInService, 'number'))
  push('Completed Trips', fmt(u.tripCount, 'number'))
  push('Cars Hauled', fmt(u.carsHauled, 'number'))
  push('Total Miles', fmt(u.totalMiles, 'number'))

  divider()

  push('PER TRUCK', '', 0, 'header')
  push('Revenue / Truck', fmt(u.revenuePerTruck, 'currency'))
  push('Truck Gross / Truck', fmt(u.truckGrossPerTruck, 'currency'))
  push('Fixed Cost / Truck', fmt(u.fixedCostPerTruck, 'currency'))
  push('Net Profit / Truck', fmt(u.netProfitPerTruck, 'currency'))

  divider()

  push('PER TRIP', '', 0, 'header')
  push('Revenue / Trip', fmt(u.revenuePerTrip, 'currency'))
  push('Truck Gross / Trip', fmt(u.truckGrossPerTrip, 'currency'))
  push('Avg Pay / Car (APPC)', fmt(u.appc, 'currency'))
  push('Overhead / Trip', fmt(u.overheadPerTrip, 'currency'))
  push('Direct Cost / Trip', fmt(u.directCostPerTrip, 'currency'))
  push('Net Profit / Trip', fmt(u.netProfitPerTrip, 'currency'))

  divider()

  push('PER MILE', '', 0, 'header')
  push('Revenue / Mile (RPM)', fmt(u.rpm, 'currency'))
  push('Truck Gross / Mile', fmt(u.truckGrossPerMile, 'currency'))
  push('Fixed Cost / Mile', fmt(u.fixedCostPerMile, 'currency'))
  push('Fuel Cost / Mile', fmt(u.fuelCostPerMile, 'currency'))
  push('Net Profit / Mile', fmt(u.netProfitPerMile, 'currency'))

  return lines
}

// ============================================================================
// Rendering helpers
// ============================================================================

const BRAND_DARK: [number, number, number] = [25, 35, 52]
const HEADER_BG: [number, number, number] = [238, 241, 246]
const SUBTOTAL_BG: [number, number, number] = [230, 235, 245]
const TOTAL_BG: [number, number, number] = [25, 35, 52]

function lineItemsToAutoTable(doc: jsPDF, lines: LineItem[], startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  autoTable(doc, {
    startY,
    head: [['Line Item', 'Amount']],
    body: lines
      .filter((l) => l.style !== 'divider')
      .map((l) => [l.label, l.value]),
    theme: 'plain',
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 45 },
    },
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
    didParseCell: (data) => {
      if (data.section !== 'body') return

      // Map back to the non-divider line items
      const nonDividerLines = lines.filter((l) => l.style !== 'divider')
      const line = nonDividerLines[data.row.index]
      if (!line) return

      switch (line.style) {
        case 'header':
          data.cell.styles.fillColor = HEADER_BG
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = BRAND_DARK
          data.cell.styles.fontSize = 7.5
          break
        case 'subtotal':
          data.cell.styles.fillColor = SUBTOTAL_BG
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = BRAND_DARK
          break
        case 'total':
          data.cell.styles.fillColor = TOTAL_BG
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontSize = 9
          break
        default:
          // Sub-items: lighter text
          if (line.indent === 2) {
            data.cell.styles.textColor = [100, 100, 100]
          }
          // Alternate rows for readability
          if (data.row.index % 2 === 0) {
            if (data.cell.styles.fillColor === undefined) {
              data.cell.styles.fillColor = [252, 252, 253]
            }
          }
      }
    },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(170, 170, 170)
      doc.text('VroomX TMS', 14, pageHeight - 10)
      doc.text(`Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 10, {
        align: 'right',
      })
      doc.setTextColor(0)
    },
  })

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return lastTable?.finalY ?? startY + 10
}

// ============================================================================
// Main export function
// ============================================================================

export function exportPnLToPdf({ pnl, periodLabel, companyName, unitMetrics }: PnLPdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let yPos = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(25, 35, 52)
  doc.text('Profit & Loss Statement', 14, yPos)
  yPos += 8

  // Company name
  if (companyName) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(companyName, 14, yPos)
    yPos += 5
  }

  // Period and generated date — same line, right-aligned date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Period: ${periodLabel}`, 14, yPos)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`,
    pageWidth - 14,
    yPos,
    { align: 'right' }
  )
  yPos += 8

  // KPI summary cards: Revenue, Clean Gross, Truck Gross, Net Profit
  const cards = [
    { label: 'Revenue', value: USD.format(pnl.revenue) },
    { label: 'Clean Gross', value: USD.format(pnl.cleanGross) },
    { label: 'Truck Gross', value: USD.format(pnl.truckGross) },
    {
      label: 'Net Profit',
      value: `${USD.format(pnl.netProfitBeforeTax)} (${PCT(pnl.netMargin)})`,
    },
  ]

  const cardCount = cards.length
  const cardWidth = (pageWidth - 28 - (cardCount - 1) * 4) / cardCount
  const cardHeight = 18

  for (let i = 0; i < cardCount; i++) {
    const card = cards[i]
    const x = 14 + i * (cardWidth + 4)

    doc.setFillColor(245, 246, 248)
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'F')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(card.label.toUpperCase(), x + 4, yPos + 6)

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(25, 35, 52)
    doc.text(card.value, x + 4, yPos + 14)
  }

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)
  yPos += cardHeight + 8

  // P&L table
  const pnlLines = buildPnLLines(pnl)
  const tableEndY = lineItemsToAutoTable(doc, pnlLines, yPos)

  // Unit metrics section (new page if close to bottom)
  if (unitMetrics) {
    const pageHeight = doc.internal.pageSize.getHeight()
    const remainingSpace = pageHeight - tableEndY - 20

    if (remainingSpace < 60) {
      doc.addPage()
      yPos = 20
    } else {
      yPos = tableEndY + 10
    }

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(25, 35, 52)
    doc.text('Unit Metrics', 14, yPos)
    yPos += 6

    const metricLines = buildUnitMetricLines(unitMetrics)
    lineItemsToAutoTable(doc, metricLines, yPos)
  }

  doc.save(`pnl-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}
