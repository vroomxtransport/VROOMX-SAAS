'use client'

import { useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, Cancel01Icon, Alert02Icon } from '@hugeicons/core-free-icons'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { cn } from '@/lib/utils'

type CellStatus = 'yes' | 'no' | 'partial' | 'text'

interface ComparisonRow {
  feature: string
  spreadsheets: { status: CellStatus; label: string }
  otherTms: { status: CellStatus; label: string }
  vroomx: { status: CellStatus; label: string }
}

const rows: ComparisonRow[] = [
  {
    feature: 'Pricing Model',
    spreadsheets: { status: 'text', label: '"Free" (your time isn\'t)' },
    otherTms: { status: 'text', label: '~30% per seat' },
    vroomx: { status: 'text', label: 'Flat $9.99/mo' },
  },
  {
    feature: 'Order Management',
    spreadsheets: { status: 'partial', label: 'Manual entry' },
    otherTms: { status: 'yes', label: 'Basic lists' },
    vroomx: { status: 'yes', label: 'Full lifecycle + VIN decode' },
  },
  {
    feature: 'Dispatch Board',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'yes', label: 'Basic board' },
    vroomx: { status: 'yes', label: 'Kanban + route building' },
  },
  {
    feature: 'Driver Mobile App',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'partial', label: 'Web link (not native)' },
    vroomx: { status: 'yes', label: 'Native iOS app' },
  },
  {
    feature: 'Automated Invoicing',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'partial', label: 'Generate only' },
    vroomx: { status: 'yes', label: 'Generate + email + BOL attach' },
  },
  {
    feature: 'Clean Gross Calculation',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'None' },
    vroomx: { status: 'yes', label: 'Per order, real-time' },
  },
  {
    feature: 'Financial Analytics',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'No reporting' },
    vroomx: { status: 'yes', label: 'KPIs + Clean Gross + margins' },
  },
  {
    feature: 'Per-Truck Profitability',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'Not supported' },
    vroomx: { status: 'yes', label: 'RPM, CPM, profit per mile' },
  },
  {
    feature: 'Driver Settlements',
    spreadsheets: { status: 'partial', label: 'Manual calc' },
    otherTms: { status: 'partial', label: '1 pay model' },
    vroomx: { status: 'yes', label: '4 pay models + per-order overrides' },
  },
  {
    feature: 'Per-Order Pay Overrides',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'None' },
    vroomx: { status: 'yes', label: 'Override any load' },
  },
  {
    feature: 'Compliance Tracking',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'Not included' },
    vroomx: { status: 'yes', label: 'CDL, med card, insurance alerts' },
  },
  {
    feature: 'Break-Even Analysis',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'no', label: 'None' },
    vroomx: { status: 'yes', label: 'Live, per truck' },
  },
  {
    feature: 'Factoring Integration',
    spreadsheets: { status: 'no', label: 'None' },
    otherTms: { status: 'partial', label: 'Manual process' },
    vroomx: { status: 'yes', label: 'One-click + auto fee calc' },
  },
  {
    feature: 'Expense Tracking',
    spreadsheets: { status: 'partial', label: 'Manual' },
    otherTms: { status: 'partial', label: 'Basic logging' },
    vroomx: { status: 'yes', label: 'Full + ties into break-even' },
  },
  {
    feature: 'Built For',
    spreadsheets: { status: 'text', label: 'Anyone' },
    otherTms: { status: 'text', label: 'Brokers first' },
    vroomx: { status: 'text', label: 'Carriers. Period.' },
  },
  {
    feature: 'Scales Without Penalty',
    spreadsheets: { status: 'no', label: 'Breaks at 10 loads' },
    otherTms: { status: 'no', label: 'Cost grows per seat' },
    vroomx: { status: 'yes', label: 'Flat price, unlimited growth' },
  },
  {
    feature: 'Setup Time',
    spreadsheets: { status: 'text', label: 'Ongoing forever' },
    otherTms: { status: 'text', label: 'Days to weeks' },
    vroomx: { status: 'text', label: 'Under 5 minutes' },
  },
]

function StatusIcon({ status }: { status: CellStatus }) {
  switch (status) {
    case 'yes':
      return <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />
    case 'no':
      return <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-red-400/70" />
    case 'partial':
      return <HugeiconsIcon icon={Alert02Icon} size={16} className="text-amber-500" />
    case 'text':
      return null
  }
}

function Cell({
  status,
  label,
  isVroomx,
}: {
  status: CellStatus
  label: string
  isVroomx?: boolean
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm',
        isVroomx && 'bg-brand/[0.06]'
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span
          className={cn(
            'text-muted-foreground',
            isVroomx && status === 'yes' && 'font-medium text-foreground'
          )}
        >
          {label}
        </span>
      </div>
    </td>
  )
}

export function ComparisonTable() {
  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section ref={sectionRef} id="comparison" className="relative py-20 sm:py-28 lg:py-32">
      <div className="bg-surface-raised">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef}>
            <div className="mx-auto max-w-2xl text-center">
              <p className="section-kicker mb-4 justify-center">
                Why VroomX TMS
              </p>
              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                See what you're actually getting
              </h2>
            </div>
          </TimelineContent>

          {/* Table */}
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef}>
            <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Feature
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Spreadsheets
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Dispatch-Only Tools
                      </th>
                      <th
                        className={cn(
                          'px-4 py-3 text-left text-sm font-bold text-brand',
                          'bg-brand/[0.06]'
                        )}
                      >
                        VroomX TMS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={row.feature}
                        className={cn(
                          idx % 2 === 0 ? 'bg-surface' : 'bg-background/50'
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {row.feature}
                        </td>
                        <Cell
                          status={row.spreadsheets.status}
                          label={row.spreadsheets.label}
                        />
                        <Cell
                          status={row.otherTms.status}
                          label={row.otherTms.label}
                        />
                        <Cell
                          status={row.vroomx.status}
                          label={row.vroomx.label}
                          isVroomx
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TimelineContent>
        </div>
      </div>
    </section>
  )
}
