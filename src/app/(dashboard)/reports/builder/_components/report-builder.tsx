'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ReportChartRenderer } from '@/components/reports/report-chart-renderer'
import { executeReport } from '@/lib/reports/report-query-engine'
import { createReport } from '@/app/actions/reports'
import {
  DATA_SOURCES,
  METRICS,
  DIMENSIONS,
  CHART_TYPES,
  getDefaultReportConfig,
  validateReportConfig,
  getMetricById,
  getDimensionById,
} from '@/lib/reports/report-config'
import type { ReportConfig, ReportResult, DataSource, ChartType } from '@/lib/reports/report-config'
import {
  Car, Milestone, IdCard, Truck, Building2, Receipt,
  Table2, BarChart3, TrendingUp, PieChart, Activity,
  Play, Save, Loader2, ChevronRight, Check, X,
} from 'lucide-react'

// ============================================================================
// Icon Mapping
// ============================================================================

const DATA_SOURCE_ICONS: Record<string, React.ElementType> = {
  Car, Milestone, IdCard, Truck, Building2, Receipt,
}

const CHART_TYPE_ICONS: Record<string, React.ElementType> = {
  Table2, BarChart3, TrendingUp, PieChart, Activity,
}

// ============================================================================
// Step Components
// ============================================================================

function StepIndicator({ step, current, label }: { step: number; current: number; label: string }) {
  const isActive = step === current
  const isDone = step < current
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
        isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'
      )}>
        {isDone ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <span className={cn(
        'text-sm font-medium transition-colors',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {label}
      </span>
      {step < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </div>
  )
}

function DataSourceStep({ config, onChange }: {
  config: ReportConfig
  onChange: (source: DataSource) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Choose a data source</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DATA_SOURCES.map((ds) => {
          const Icon = DATA_SOURCE_ICONS[ds.icon] ?? Car
          const isSelected = config.dataSource === ds.id
          return (
            <button
              key={ds.id}
              onClick={() => onChange(ds.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-all duration-200',
                isSelected
                  ? 'border-brand bg-brand/5 shadow-sm'
                  : 'border-border-subtle hover:border-brand/40 hover:bg-muted/30'
              )}
            >
              <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', isSelected ? 'text-brand' : 'text-muted-foreground')} />
              <div>
                <p className={cn('text-sm font-medium', isSelected ? 'text-foreground' : 'text-foreground/80')}>
                  {ds.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{ds.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MetricsStep({ config, onChange }: {
  config: ReportConfig
  onChange: (metrics: string[]) => void
}) {
  const available = METRICS[config.dataSource]

  const toggle = (id: string) => {
    if (config.metrics.includes(id)) {
      onChange(config.metrics.filter((m) => m !== id))
    } else {
      onChange([...config.metrics, id])
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-1">Select metrics to measure</h3>
      <p className="text-xs text-muted-foreground mb-3">Choose what numbers to include in your report</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {available.map((m) => {
          const isSelected = config.metrics.includes(m.id)
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                isSelected
                  ? 'border-brand bg-brand/5'
                  : 'border-border-subtle hover:border-brand/40'
              )}
            >
              <div className={cn(
                'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                isSelected ? 'bg-brand border-brand' : 'border-muted-foreground/30'
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.label}</p>
                <p className="text-xs text-muted-foreground truncate">{m.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DimensionsStep({ config, onChange }: {
  config: ReportConfig
  onChange: (dimensions: string[]) => void
}) {
  const available = DIMENSIONS[config.dataSource]

  const toggle = (id: string) => {
    if (config.dimensions.includes(id)) {
      onChange(config.dimensions.filter((d) => d !== id))
    } else {
      onChange([...config.dimensions, id])
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-1">Group by dimensions</h3>
      <p className="text-xs text-muted-foreground mb-3">Choose how to break down your data (optional for tables)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {available.map((d) => {
          const isSelected = config.dimensions.includes(d.id)
          return (
            <button
              key={d.id}
              onClick={() => toggle(d.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                isSelected
                  ? 'border-brand bg-brand/5'
                  : 'border-border-subtle hover:border-brand/40'
              )}
            >
              <div className={cn(
                'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                isSelected ? 'bg-brand border-brand' : 'border-muted-foreground/30'
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.description}
                  {d.dateGranularity && ` (by ${d.dateGranularity})`}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChartTypeStep({ config, onChange }: {
  config: ReportConfig
  onChange: (chartType: ChartType) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Choose visualization</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CHART_TYPES.map((ct) => {
          const Icon = CHART_TYPE_ICONS[ct.icon] ?? BarChart3
          const isSelected = config.chartType === ct.id
          const metricsOk = config.metrics.length >= ct.minMetrics && config.metrics.length <= ct.maxMetrics
          const dimsOk = config.dimensions.length >= ct.minDimensions && config.dimensions.length <= ct.maxDimensions
          const isCompatible = metricsOk && dimsOk

          return (
            <button
              key={ct.id}
              onClick={() => isCompatible && onChange(ct.id)}
              disabled={!isCompatible}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all duration-200',
                isSelected
                  ? 'border-brand bg-brand/5 shadow-sm'
                  : isCompatible
                    ? 'border-border-subtle hover:border-brand/40'
                    : 'border-border-subtle opacity-40 cursor-not-allowed'
              )}
            >
              <Icon className={cn('h-6 w-6', isSelected ? 'text-brand' : 'text-muted-foreground')} />
              <span className="text-xs font-medium">{ct.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Main Report Builder
// ============================================================================

export function ReportBuilder() {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<ReportConfig>(getDefaultReportConfig('orders'))
  const [reportName, setReportName] = useState('')
  const [result, setResult] = useState<ReportResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const validation = useMemo(() => validateReportConfig(config), [config])

  const metrics = useMemo(() =>
    config.metrics.map((id) => getMetricById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getMetricById>>[],
    [config.metrics]
  )

  const dimensions = useMemo(() =>
    config.dimensions.map((id) => getDimensionById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getDimensionById>>[],
    [config.dimensions]
  )

  const handleDataSourceChange = useCallback((source: DataSource) => {
    setConfig(getDefaultReportConfig(source))
    setResult(null)
  }, [])

  const handleRunReport = useCallback(async () => {
    if (!validation.valid) return
    setIsRunning(true)
    setResult(null)

    try {
      const res = await executeReport(supabase, config, metrics, dimensions)
      setResult(res)
    } catch (err) {
      console.error('Report execution failed:', err)
    } finally {
      setIsRunning(false)
    }
  }, [supabase, config, metrics, dimensions, validation.valid])

  const handleSave = useCallback(async () => {
    if (!reportName.trim()) return
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const res = await createReport({
        name: reportName,
        description: config.description,
        config,
      })

      if ('error' in res && res.error) {
        setSaveMessage('Failed to save report')
      } else {
        setSaveMessage('Report saved')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch {
      setSaveMessage('Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }, [reportName, config])

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="widget-card">
        <div className="flex items-center gap-4 flex-wrap">
          <StepIndicator step={1} current={step} label="Data Source" />
          <StepIndicator step={2} current={step} label="Metrics" />
          <StepIndicator step={3} current={step} label="Dimensions" />
          <StepIndicator step={4} current={step} label="Visualize" />
        </div>
      </div>

      {/* Step content */}
      <div className="widget-card">
        {step === 1 && (
          <DataSourceStep config={config} onChange={handleDataSourceChange} />
        )}
        {step === 2 && (
          <MetricsStep config={config} onChange={(m) => setConfig({ ...config, metrics: m })} />
        )}
        {step === 3 && (
          <DimensionsStep config={config} onChange={(d) => setConfig({ ...config, dimensions: d })} />
        )}
        {step === 4 && (
          <ChartTypeStep config={config} onChange={(ct) => setConfig({ ...config, chartType: ct })} />
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-subtle">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="text-sm"
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 2 && config.metrics.length === 0}
                className="text-sm"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleRunReport}
                disabled={!validation.valid || isRunning}
                className="text-sm"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" />
                    Run Report
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Validation errors */}
        {step === 4 && !validation.valid && (
          <div className="mt-3 space-y-1">
            {validation.errors.map((err, i) => (
              <p key={i} className="text-xs text-red-500 flex items-center gap-1">
                <X className="h-3 w-3" /> {err}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Report result */}
      {result && (
        <div className="space-y-4">
          {/* Save bar */}
          <div className="widget-card">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Report name..."
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="h-9 max-w-xs text-sm"
              />
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={!reportName.trim() || isSaving}
                className="text-sm h-9"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save Report
              </Button>
              {saveMessage && (
                <span className={cn(
                  'text-xs font-medium',
                  saveMessage === 'Report saved' ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {saveMessage}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {result.totalRows} row{result.totalRows !== 1 ? 's' : ''}
                {' \u00b7 '}
                Generated {new Date(result.executedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Chart */}
          <ReportChartRenderer
            chartType={config.chartType}
            columns={result.columns}
            rows={result.rows}
            title={reportName || 'Report Results'}
          />
        </div>
      )}
    </div>
  )
}
