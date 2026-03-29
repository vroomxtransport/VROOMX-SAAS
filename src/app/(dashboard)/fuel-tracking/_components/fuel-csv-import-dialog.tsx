'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import Papa from 'papaparse'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTrucks } from '@/hooks/use-trucks'
import { useDrivers } from '@/hooks/use-drivers'
import { batchCreateFuelEntries, type CsvFuelRow, type FuelBatchResult } from '@/app/actions/fuel'

// ============================================================================
// Types
// ============================================================================

type Step = 'upload' | 'map' | 'preview' | 'import'

interface FuelField {
  key: keyof CsvFuelRow
  label: string
  required: boolean
}

// ============================================================================
// Constants
// ============================================================================

const FUEL_FIELDS: FuelField[] = [
  { key: 'date',            label: 'Date',          required: true  },
  { key: 'truck',           label: 'Truck',         required: true  },
  { key: 'driver',          label: 'Driver',        required: false },
  { key: 'gallons',         label: 'Gallons',       required: true  },
  { key: 'cost_per_gallon', label: 'Cost/Gallon',   required: true  },
  { key: 'odometer',        label: 'Odometer',      required: false },
  { key: 'location',        label: 'Location',      required: false },
  { key: 'state',           label: 'State',         required: false },
  { key: 'notes',           label: 'Notes',         required: false },
]

const REQUIRED_FIELDS = FUEL_FIELDS.filter((f) => f.required).map((f) => f.key)

/** Normalize string for fuzzy matching */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Alias map for auto-mapping CSV headers to fuel fields */
const FIELD_ALIASES: Record<keyof CsvFuelRow, string[]> = {
  date:            ['date', 'fueldate', 'transactiondate', 'transdate'],
  truck:           ['truck', 'truckid', 'unitnumber', 'unit', 'vehicle', 'trucknumber'],
  driver:          ['driver', 'driverid', 'drivername'],
  gallons:         ['gallons', 'gal', 'quantity', 'qty', 'fuelqty'],
  cost_per_gallon: ['costpergallon', 'pricepergallon', 'cpg', 'price', 'unitprice', 'ppg'],
  odometer:        ['odometer', 'odo', 'miles', 'mileage'],
  location:        ['location', 'station', 'pump', 'store', 'fuelstation'],
  state:           ['state', 'statecode', 'st'],
  notes:           ['notes', 'memo', 'comment', 'description'],
}

/** Auto-map CSV headers to fuel fields by fuzzy name matching */
function autoMap(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  for (const header of csvHeaders) {
    const norm = normalize(header)
    for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
      if (norm === normalize(fieldKey) || aliases.includes(norm)) {
        if (!Object.values(mapping).includes(fieldKey)) {
          mapping[header] = fieldKey
          break
        }
      }
    }
  }

  return mapping
}

// ============================================================================
// Component
// ============================================================================

interface FuelCsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FuelCsvImportDialog({ open, onOpenChange }: FuelCsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<FuelBatchResult | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  // Truck and driver data for resolution
  const { data: trucksData } = useTrucks({ pageSize: 500 })
  const { data: driversData } = useDrivers({ pageSize: 500 })

  const trucks = useMemo(() => trucksData?.trucks ?? [], [trucksData])
  const drivers = useMemo(() => driversData?.drivers ?? [], [driversData])

  /** unit_number (lower) → id, plus id → id for direct UUID input */
  const truckMap = useMemo(() => {
    const map: Record<string, string> = {}
    trucks.forEach((t) => {
      map[t.unit_number.toLowerCase()] = t.id
      map[t.id] = t.id
    })
    return map
  }, [trucks])

  /** full name (lower) → id, id → id, first name (lower) → id */
  const driverMap = useMemo(() => {
    const map: Record<string, string> = {}
    drivers.forEach((d) => {
      const fullName = `${d.first_name} ${d.last_name}`.toLowerCase()
      map[fullName] = d.id
      map[d.id] = d.id
      if (d.first_name) map[d.first_name.toLowerCase()] = d.id
    })
    return map
  }, [drivers])

  /** Reverse lookup: id → display label for preview */
  const truckLabel = useMemo(() => {
    const map: Record<string, string> = {}
    trucks.forEach((t) => { map[t.id] = t.unit_number })
    return map
  }, [trucks])

  const driverLabel = useMemo(() => {
    const map: Record<string, string> = {}
    drivers.forEach((d) => { map[d.id] = `${d.first_name} ${d.last_name}` })
    return map
  }, [drivers])

  // ============================================================================
  // Reset
  // ============================================================================

  const reset = useCallback(() => {
    setStep('upload')
    setCsvHeaders([])
    setCsvData([])
    setColumnMapping({})
    setImporting(false)
    setImportResult(null)
    setErrorsExpanded(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset()
      onOpenChange(nextOpen)
    },
    [onOpenChange, reset]
  )

  // ============================================================================
  // Step 1: Upload
  // ============================================================================

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) return
        const headers = results.meta.fields ?? []
        setCsvHeaders(headers)
        setCsvData(results.data)
        setColumnMapping(autoMap(headers))
        setStep('map')
      },
    })
  }, [])

  // ============================================================================
  // Step 2: Map Columns
  // ============================================================================

  const handleMappingChange = useCallback((csvHeader: string, fuelField: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev }
      if (fuelField === '__skip__') {
        delete next[csvHeader]
        return next
      }
      // Remove any existing mapping to this fuel field (prevent duplicates)
      for (const [key, val] of Object.entries(next)) {
        if (val === fuelField && key !== csvHeader) {
          delete next[key]
        }
      }
      next[csvHeader] = fuelField
      return next
    })
  }, [])

  const requiredFieldsMapped = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMapping))
    return REQUIRED_FIELDS.every((f) => mappedFields.has(f))
  }, [columnMapping])

  const unmappedRequired = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMapping))
    return REQUIRED_FIELDS.filter((f) => !mappedFields.has(f))
  }, [columnMapping])

  // ============================================================================
  // Step 3: Preview & Validate
  // ============================================================================

  /** Map raw CSV rows to CsvFuelRow using column mapping */
  const mappedRows = useMemo(() => {
    const reverseMap: Record<string, string> = {}
    for (const [csvHeader, fuelField] of Object.entries(columnMapping)) {
      reverseMap[fuelField] = csvHeader
    }

    return csvData.map((row) => {
      const mapped: CsvFuelRow = {}
      for (const field of FUEL_FIELDS) {
        const csvHeader = reverseMap[field.key]
        if (csvHeader && row[csvHeader] !== undefined) {
          ;(mapped as Record<string, string | undefined>)[field.key] = row[csvHeader]
        }
      }
      return mapped
    })
  }, [csvData, columnMapping])

  /** Client-side validation per row */
  const validationErrors = useMemo(() => {
    const errors: Map<number, string[]> = new Map()

    mappedRows.forEach((row, idx) => {
      const rowErrors: string[] = []

      // date: required, parseable
      if (!row.date?.trim()) {
        rowErrors.push('Date is required')
      } else if (isNaN(Date.parse(row.date.trim()))) {
        rowErrors.push('Date is not a valid date')
      }

      // truck: required, must resolve
      if (!row.truck?.trim()) {
        rowErrors.push('Truck is required')
      } else if (!truckMap[row.truck.trim().toLowerCase()]) {
        rowErrors.push(`Truck "${row.truck}" not found`)
      }

      // gallons: required, > 0
      if (!row.gallons) {
        rowErrors.push('Gallons is required')
      } else {
        const g = Number(row.gallons)
        if (isNaN(g) || g <= 0) rowErrors.push('Gallons must be greater than 0')
      }

      // cost_per_gallon: required, > 0
      if (!row.cost_per_gallon) {
        rowErrors.push('Cost/Gallon is required')
      } else {
        const c = Number(row.cost_per_gallon)
        if (isNaN(c) || c <= 0) rowErrors.push('Cost/Gallon must be greater than 0')
      }

      // odometer: optional, >= 0
      if (row.odometer !== undefined && row.odometer !== '') {
        const o = Number(row.odometer)
        if (isNaN(o) || o < 0) rowErrors.push('Odometer must be 0 or greater')
      }

      // state: optional, 2 chars
      if (row.state?.trim() && row.state.trim().length !== 2) {
        rowErrors.push('State must be a 2-letter code')
      }

      if (rowErrors.length > 0) errors.set(idx, rowErrors)
    })

    return errors
  }, [mappedRows, truckMap])

  const validRowCount = mappedRows.length - validationErrors.size
  const invalidRowCount = validationErrors.size

  // ============================================================================
  // Step 4: Import
  // ============================================================================

  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const result = await batchCreateFuelEntries(mappedRows, truckMap, driverMap)
      setImportResult(result)
    } catch (err) {
      setImportResult({
        created: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Unknown error' }],
      })
    } finally {
      setImporting(false)
    }
  }, [mappedRows, truckMap, driverMap])

  // ============================================================================
  // Navigation
  // ============================================================================

  const steps = useMemo<Step[]>(() => ['upload', 'map', 'preview', 'import'], [])
  const stepIndex = steps.indexOf(step)

  const canGoNext =
    (step === 'upload' && csvData.length > 0) ||
    (step === 'map' && requiredFieldsMapped) ||
    (step === 'preview' && validRowCount > 0)

  const goNext = useCallback(() => {
    if (step === 'preview') {
      handleImport()
      setStep('import')
    } else {
      setStep(steps[stepIndex + 1])
    }
  }, [step, stepIndex, handleImport, steps])

  const goBack = useCallback(() => {
    if (step === 'import' && importResult) {
      reset()
      return
    }
    setStep(steps[stepIndex - 1])
  }, [step, stepIndex, importResult, reset, steps])

  // ============================================================================
  // Step Labels
  // ============================================================================

  const stepLabels: Record<Step, string> = {
    upload:  '1. Upload',
    map:     '2. Map Columns',
    preview: '3. Preview',
    import:  '4. Import',
  }

  // ============================================================================
  // Render helpers: truck/driver display in preview
  // ============================================================================

  function renderTruckCell(row: CsvFuelRow) {
    if (!row.truck?.trim()) return <span className="text-muted-foreground/50">—</span>
    const key = row.truck.trim().toLowerCase()
    const id = truckMap[key]
    if (id) {
      return (
        <span className="text-green-600 font-medium text-xs">
          {truckLabel[id] ?? row.truck}
        </span>
      )
    }
    return (
      <span className="text-red-600 text-xs" title="Truck not found">
        {row.truck}
      </span>
    )
  }

  function renderDriverCell(row: CsvFuelRow) {
    if (!row.driver?.trim()) return <span className="text-muted-foreground/50">—</span>
    const key = row.driver.trim().toLowerCase()
    const id = driverMap[key]
    if (id) {
      return (
        <span className="text-green-600 font-medium text-xs">
          {driverLabel[id] ?? row.driver}
        </span>
      )
    }
    return (
      <span className="text-amber-600 text-xs" title="Driver not found — will be skipped">
        {row.driver}
      </span>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Fuel Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file, map columns to fuel fields, preview data, and import up to 500 rows at once.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/60 mx-0.5">/</span>}
              <span
                className={
                  s === step
                    ? 'font-semibold text-blue-600'
                    : i < stepIndex
                      ? 'text-green-600'
                      : 'text-muted-foreground/60'
                }
              >
                {stepLabels[s]}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* ============ STEP 1: Upload ============ */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="rounded-full bg-blue-50 p-4">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Select a CSV file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Headers should match fuel fields (Date, Truck, Gallons, Cost/Gallon, etc.)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Choose CSV File
              </Button>
              {csvData.length > 0 && (
                <Badge variant="secondary">
                  {csvData.length} rows, {csvHeaders.length} columns loaded
                </Badge>
              )}
            </div>
          )}

          {/* ============ STEP 2: Map Columns ============ */}
          {step === 'map' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Map your CSV columns to fuel fields. Required fields are marked with{' '}
                  <span className="text-red-500">*</span>
                </p>
                {!requiredFieldsMapped && (
                  <Badge variant="destructive" className="text-xs">
                    Missing:{' '}
                    {unmappedRequired
                      .map((f) => FUEL_FIELDS.find((o) => o.key === f)?.label)
                      .join(', ')}
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[340px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">CSV Column</TableHead>
                      <TableHead>Maps To</TableHead>
                      <TableHead className="w-24">Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvHeaders.map((header) => {
                      const currentMapping = columnMapping[header] || ''
                      const sampleValue = csvData[0]?.[header] ?? ''
                      return (
                        <TableRow key={header}>
                          <TableCell className="font-mono text-xs">{header}</TableCell>
                          <TableCell>
                            <Select
                              value={currentMapping || '__skip__'}
                              onValueChange={(val) => handleMappingChange(header, val)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Skip" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">-- Skip --</SelectItem>
                                {FUEL_FIELDS.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.required ? `${field.label} *` : field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {sampleValue}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* ============ STEP 3: Preview & Validate ============ */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {csvData.length} total rows
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-50 text-green-700"
                >
                  {validRowCount} valid
                </Badge>
                {invalidRowCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {invalidRowCount} invalid
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      {Object.entries(columnMapping).map(([, field]) => {
                        const f = FUEL_FIELDS.find((o) => o.key === field)
                        return f ? (
                          <TableHead key={field} className="text-xs">
                            {f.label}
                          </TableHead>
                        ) : null
                      })}
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRows.slice(0, 10).map((row, idx) => {
                      const rowErrors = validationErrors.get(idx)
                      const hasErrors = !!rowErrors
                      return (
                        <TableRow
                          key={idx}
                          className={hasErrors ? 'bg-red-50' : ''}
                        >
                          <TableCell className="text-xs text-muted-foreground/60">
                            {idx + 1}
                          </TableCell>
                          {Object.entries(columnMapping).map(([, field]) => {
                            // Truck and driver get special resolved rendering
                            if (field === 'truck') {
                              return (
                                <TableCell key={field} className="text-xs max-w-[100px] truncate">
                                  {renderTruckCell(row)}
                                </TableCell>
                              )
                            }
                            if (field === 'driver') {
                              return (
                                <TableCell key={field} className="text-xs max-w-[100px] truncate">
                                  {renderDriverCell(row)}
                                </TableCell>
                              )
                            }
                            const val = (row as Record<string, string | number | undefined>)[field]
                            return (
                              <TableCell key={field} className="text-xs max-w-[100px] truncate">
                                {val !== undefined && val !== '' ? String(val) : '-'}
                              </TableCell>
                            )
                          })}
                          <TableCell>
                            {hasErrors ? (
                              <span
                                className="text-xs text-red-600 cursor-help"
                                title={rowErrors.join('; ')}
                              >
                                <AlertCircle className="inline h-3 w-3 mr-1" />
                                Error
                              </span>
                            ) : (
                              <span className="text-xs text-green-600">
                                <CheckCircle2 className="inline h-3 w-3 mr-1" />
                                OK
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {mappedRows.length > 10 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">
                    Showing first 10 of {mappedRows.length} rows
                  </p>
                )}
              </ScrollArea>

              {invalidRowCount > 0 && (
                <p className="text-xs text-amber-600">
                  Invalid rows will be skipped during import. Only {validRowCount} valid rows will be imported.
                </p>
              )}
            </div>
          )}

          {/* ============ STEP 4: Import ============ */}
          {step === 'import' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              {importing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-muted-foreground">
                    Importing {mappedRows.length} fuel transactions...
                  </p>
                </>
              ) : importResult ? (
                <>
                  <div className="rounded-full bg-green-50 p-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-foreground">Import Complete</p>
                    <p className="text-sm text-muted-foreground">
                      {importResult.created} fuel entr{importResult.created !== 1 ? 'ies' : 'y'} created
                      successfully
                    </p>
                    {importResult.errors.length > 0 && (
                      <p className="text-sm text-red-600">
                        {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''}{' '}
                        failed
                      </p>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="w-full">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setErrorsExpanded(!errorsExpanded)}
                      >
                        {errorsExpanded ? (
                          <ChevronUp className="mr-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="mr-1 h-3 w-3" />
                        )}
                        {errorsExpanded ? 'Hide' : 'Show'} error details
                      </Button>
                      {errorsExpanded && (
                        <ScrollArea className="h-[150px] mt-2">
                          <div className="space-y-1 px-2">
                            {importResult.errors.map((err, i) => (
                              <div
                                key={i}
                                className="text-xs text-red-700 bg-red-50 rounded px-2 py-1"
                              >
                                <span className="font-medium">Row {err.row}:</span> {err.message}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {stepIndex > 0 && step !== 'import' && (
              <Button variant="outline" size="sm" onClick={goBack}>
                <ArrowLeft className="mr-1 h-3 w-3" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'import' && importResult && (
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            )}
            {step !== 'import' && (
              <Button size="sm" disabled={!canGoNext} onClick={goNext}>
                {step === 'preview' ? (
                  <>
                    Import {validRowCount} Fuel Entr{validRowCount !== 1 ? 'ies' : 'y'}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
