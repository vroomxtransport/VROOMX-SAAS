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
import { batchCreateOrders, type CsvOrderRow, type BatchImportResult } from '@/app/actions/orders'

// ============================================================================
// Types
// ============================================================================

type Step = 'upload' | 'map' | 'preview' | 'import'

interface OrderField {
  key: keyof CsvOrderRow
  label: string
  required: boolean
  group: string
}

// ============================================================================
// Constants
// ============================================================================

const ORDER_FIELDS: OrderField[] = [
  // Vehicle
  { key: 'vehicle_vin', label: 'VIN', required: false, group: 'Vehicle' },
  { key: 'vehicle_year', label: 'Year', required: false, group: 'Vehicle' },
  { key: 'vehicle_make', label: 'Make', required: false, group: 'Vehicle' },
  { key: 'vehicle_model', label: 'Model', required: false, group: 'Vehicle' },
  { key: 'vehicle_color', label: 'Color', required: false, group: 'Vehicle' },
  { key: 'vehicle_type', label: 'Type', required: false, group: 'Vehicle' },
  // Pickup
  { key: 'pickup_location', label: 'Pickup Address', required: false, group: 'Pickup' },
  { key: 'pickup_city', label: 'Pickup City', required: true, group: 'Pickup' },
  { key: 'pickup_state', label: 'Pickup State', required: true, group: 'Pickup' },
  { key: 'pickup_zip', label: 'Pickup ZIP', required: false, group: 'Pickup' },
  { key: 'pickup_contact_name', label: 'Pickup Contact', required: false, group: 'Pickup' },
  { key: 'pickup_contact_phone', label: 'Pickup Phone', required: false, group: 'Pickup' },
  { key: 'pickup_date', label: 'Pickup Date', required: false, group: 'Pickup' },
  // Delivery
  { key: 'delivery_location', label: 'Delivery Address', required: false, group: 'Delivery' },
  { key: 'delivery_city', label: 'Delivery City', required: true, group: 'Delivery' },
  { key: 'delivery_state', label: 'Delivery State', required: true, group: 'Delivery' },
  { key: 'delivery_zip', label: 'Delivery ZIP', required: false, group: 'Delivery' },
  { key: 'delivery_contact_name', label: 'Delivery Contact', required: false, group: 'Delivery' },
  { key: 'delivery_contact_phone', label: 'Delivery Phone', required: false, group: 'Delivery' },
  { key: 'delivery_date', label: 'Delivery Date', required: false, group: 'Delivery' },
  // Pricing
  { key: 'revenue', label: 'Revenue', required: false, group: 'Pricing' },
  { key: 'carrier_pay', label: 'Carrier Pay', required: false, group: 'Pricing' },
  { key: 'broker_fee', label: 'Broker Fee', required: false, group: 'Pricing' },
  { key: 'payment_type', label: 'Payment Type', required: false, group: 'Pricing' },
]

const REQUIRED_FIELDS = ORDER_FIELDS.filter((f) => f.required).map((f) => f.key)

/** Fuzzy matching: normalize string for column-to-field auto-mapping */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Auto-map CSV headers to order fields by fuzzy name matching */
function autoMap(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  // Build aliases for each order field
  const aliases: Record<string, string[]> = {
    vehicle_vin: ['vin', 'vehiclevin'],
    vehicle_year: ['year', 'vehicleyear', 'yr'],
    vehicle_make: ['make', 'vehiclemake'],
    vehicle_model: ['model', 'vehiclemodel'],
    vehicle_color: ['color', 'vehiclecolor', 'colour'],
    vehicle_type: ['type', 'vehicletype'],
    pickup_location: ['pickuplocation', 'pickupaddress', 'originaddress', 'origin'],
    pickup_city: ['pickupcity', 'origincity'],
    pickup_state: ['pickupstate', 'originstate'],
    pickup_zip: ['pickupzip', 'pickupzipcode', 'originzip'],
    pickup_contact_name: ['pickupcontact', 'pickupcontactname', 'origincontact'],
    pickup_contact_phone: ['pickupphone', 'pickupcontactphone', 'originphone'],
    pickup_date: ['pickupdate', 'pickdt'],
    delivery_location: ['deliverylocation', 'deliveryaddress', 'destinationaddress', 'destination'],
    delivery_city: ['deliverycity', 'destinationcity', 'destcity'],
    delivery_state: ['deliverystate', 'destinationstate', 'deststate'],
    delivery_zip: ['deliveryzip', 'deliveryzipcode', 'destinationzip', 'destzip'],
    delivery_contact_name: ['deliverycontact', 'deliverycontactname', 'destinationcontact'],
    delivery_contact_phone: ['deliveryphone', 'deliverycontactphone', 'destinationphone'],
    delivery_date: ['deliverydate', 'deldt'],
    revenue: ['revenue', 'price', 'amount', 'total'],
    carrier_pay: ['carrierpay', 'pay', 'driverpay'],
    broker_fee: ['brokerfee', 'fee'],
    payment_type: ['paymenttype', 'payment', 'paytype'],
  }

  for (const header of csvHeaders) {
    const norm = normalize(header)
    for (const [fieldKey, fieldAliases] of Object.entries(aliases)) {
      // Exact match on the field key itself (normalized)
      if (norm === normalize(fieldKey) || fieldAliases.includes(norm)) {
        // Only map if not already mapped
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

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

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
      if (!nextOpen) {
        reset()
      }
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
        // Auto-map columns
        setColumnMapping(autoMap(headers))
        setStep('map')
      },
    })
  }, [])

  // ============================================================================
  // Step 2: Map Columns
  // ============================================================================

  const handleMappingChange = useCallback(
    (csvHeader: string, orderField: string) => {
      setColumnMapping((prev) => {
        const next = { ...prev }
        // If orderField is 'skip', remove the mapping
        if (orderField === '__skip__') {
          delete next[csvHeader]
          return next
        }
        // Remove any existing mapping to this order field (prevent duplicates)
        for (const [key, val] of Object.entries(next)) {
          if (val === orderField && key !== csvHeader) {
            delete next[key]
          }
        }
        next[csvHeader] = orderField
        return next
      })
    },
    []
  )

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

  /** Map raw CSV rows to order rows using column mapping */
  const mappedRows = useMemo(() => {
    // Build reverse mapping: orderField -> csvHeader
    const reverseMap: Record<string, string> = {}
    for (const [csvHeader, orderField] of Object.entries(columnMapping)) {
      reverseMap[orderField] = csvHeader
    }

    return csvData.map((row) => {
      const mapped: CsvOrderRow = {}
      for (const field of ORDER_FIELDS) {
        const csvHeader = reverseMap[field.key]
        if (csvHeader && row[csvHeader] !== undefined) {
          ;(mapped as Record<string, string | undefined>)[field.key] = row[csvHeader]
        }
      }
      return mapped
    })
  }, [csvData, columnMapping])

  /** Validate mapped rows client-side */
  const validationErrors = useMemo(() => {
    const errors: Map<number, string[]> = new Map()

    mappedRows.forEach((row, idx) => {
      const rowErrors: string[] = []

      if (!row.pickup_city?.trim()) rowErrors.push('Missing pickup city')
      if (!row.pickup_state?.trim()) rowErrors.push('Missing pickup state')
      if (!row.delivery_city?.trim()) rowErrors.push('Missing delivery city')
      if (!row.delivery_state?.trim()) rowErrors.push('Missing delivery state')

      if (row.pickup_state && row.pickup_state.trim().length !== 2)
        rowErrors.push('Pickup state must be 2 characters')
      if (row.delivery_state && row.delivery_state.trim().length !== 2)
        rowErrors.push('Delivery state must be 2 characters')

      if (row.vehicle_vin && row.vehicle_vin.trim().length !== 17)
        rowErrors.push('VIN must be 17 characters')

      if (row.vehicle_year) {
        const y = Number(row.vehicle_year)
        if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 2)
          rowErrors.push('Invalid year')
      }

      if (row.revenue && isNaN(Number(row.revenue))) rowErrors.push('Invalid revenue')
      if (row.carrier_pay && isNaN(Number(row.carrier_pay))) rowErrors.push('Invalid carrier pay')

      if (rowErrors.length > 0) {
        errors.set(idx, rowErrors)
      }
    })

    return errors
  }, [mappedRows])

  const validRowCount = mappedRows.length - validationErrors.size
  const invalidRowCount = validationErrors.size

  // ============================================================================
  // Step 4: Import
  // ============================================================================

  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const result = await batchCreateOrders(mappedRows)
      setImportResult(result)
    } catch (err) {
      setImportResult({
        created: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Unknown error' }],
      })
    } finally {
      setImporting(false)
    }
  }, [mappedRows])

  // ============================================================================
  // Navigation
  // ============================================================================

  const steps: Step[] = ['upload', 'map', 'preview', 'import']
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
  }, [step, stepIndex, handleImport])

  const goBack = useCallback(() => {
    if (step === 'import' && importResult) {
      // After import completed, go back to upload (reset)
      reset()
      return
    }
    setStep(steps[stepIndex - 1])
  }, [step, stepIndex, importResult, reset])

  // ============================================================================
  // Step Labels
  // ============================================================================

  const stepLabels: Record<Step, string> = {
    upload: '1. Upload',
    map: '2. Map Columns',
    preview: '3. Preview',
    import: '4. Import',
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file, map columns to order fields, preview data, and import.
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
              <div className="rounded-full bg-blue-50 dark:bg-blue-950/30 p-4">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Select a CSV file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Headers should match order fields (VIN, Make, Model, Pickup City, etc.)
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
                  Map your CSV columns to order fields. Required fields are marked with{' '}
                  <span className="text-red-500">*</span>
                </p>
                {!requiredFieldsMapped && (
                  <Badge variant="destructive" className="text-xs">
                    Missing: {unmappedRequired.map((f) => ORDER_FIELDS.find((o) => o.key === f)?.label).join(', ')}
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
                          <TableCell className="font-mono text-xs">
                            {header}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={currentMapping || '__skip__'}
                              onValueChange={(val) => handleMappingChange(header, val)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Skip" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">
                                  -- Skip --
                                </SelectItem>
                                {ORDER_FIELDS.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.required ? `${field.label} *` : field.label}
                                    {' '}
                                    <span className="text-muted-foreground/60 text-[10px]">({field.group})</span>
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
                <Badge variant="secondary" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
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
                      <TableHead className="w-10">#</TableHead>
                      {Object.entries(columnMapping).map(([, field]) => {
                        const f = ORDER_FIELDS.find((o) => o.key === field)
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
                          className={hasErrors ? 'bg-red-50 dark:bg-red-950/30' : ''}
                        >
                          <TableCell className="text-xs text-muted-foreground/60">
                            {idx + 1}
                          </TableCell>
                          {Object.entries(columnMapping).map(([, field]) => {
                            const val = (row as Record<string, string | undefined>)[field]
                            return (
                              <TableCell key={field} className="text-xs max-w-[100px] truncate">
                                {val ?? '-'}
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
                    Importing {mappedRows.length} orders...
                  </p>
                </>
              ) : importResult ? (
                <>
                  <div className="rounded-full bg-green-50 dark:bg-green-950/30 p-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-foreground">
                      Import Complete
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {importResult.created} order{importResult.created !== 1 ? 's' : ''} created successfully
                    </p>
                    {importResult.errors.length > 0 && (
                      <p className="text-sm text-red-600">
                        {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} failed
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
                                className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1"
                              >
                                <span className="font-medium">Row {err.row}:</span>{' '}
                                {err.message}
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
              <Button
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            )}
            {step !== 'import' && (
              <Button
                size="sm"
                disabled={!canGoNext}
                onClick={goNext}
              >
                {step === 'preview' ? (
                  <>
                    Import {validRowCount} Orders
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
