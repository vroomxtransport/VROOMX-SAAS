'use client'

import { useState, useRef } from 'react'
import { FileUp, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { importOrdersFromPDF, confirmPdfImport } from '@/app/actions/import-pdf'
import type { ExtractedOrder } from '@/lib/ai/pdf-parser'

interface PDFImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'upload' | 'review' | 'result'

export function PDFImportDialog({ open, onOpenChange }: PDFImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [orders, setOrders] = useState<ExtractedOrder[]>([])
  const [importResult, setImportResult] = useState<{ created: string[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setUploading(false)
    setConfirming(false)
    setOrders([])
    setImportResult(null)
    setError(null)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const result = await importOrdersFromPDF(formData)

    if ('error' in result) {
      setError(result.error)
      setUploading(false)
      return
    }

    if (result.data.orders.length === 0) {
      setError('No orders could be extracted from this PDF. Try a different document.')
      setUploading(false)
      return
    }

    setOrders(result.data.orders)
    setStep('review')
    setUploading(false)
  }

  async function handleConfirm() {
    setConfirming(true)
    setError(null)

    const validOrders = orders.filter((o) => o.valid).map((o) => o.data)

    if (validOrders.length === 0) {
      setError('No valid orders to import.')
      setConfirming(false)
      return
    }

    const result = await confirmPdfImport(validOrders)

    if ('error' in result) {
      setError(result.error as string)
      setConfirming(false)
      return
    }

    if ('data' in result && result.data) {
      setImportResult(result.data)
    }
    setStep('result')
    setConfirming(false)
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      handleUpload(file)
    } else {
      setError('Please drop a PDF file.')
    }
  }

  const validCount = orders.filter((o) => o.valid).length
  const invalidCount = orders.filter((o) => !o.valid).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-brand" />
            Import Orders from PDF
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <span className={step === 'upload' ? 'text-brand font-semibold' : ''}>1. Upload</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'review' ? 'text-brand font-semibold' : ''}>2. Review</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'result' ? 'text-brand font-semibold' : ''}>3. Confirm</span>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <div
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 hover:border-brand/40 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 text-brand animate-spin mb-4" />
                <p className="text-sm font-medium">Analyzing PDF with AI...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
              </>
            ) : (
              <>
                <FileUp className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-sm font-medium">Drop your PDF here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Rate confirmations, dispatch contracts, manifests (25MB max)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <span className="font-medium">{orders.length}</span> order{orders.length !== 1 ? 's' : ''} found
                {invalidCount > 0 && (
                  <span className="text-amber-600 ml-2">({invalidCount} with issues)</span>
                )}
              </p>
            </div>

            {orders.map((order, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 space-y-2 ${
                  order.valid
                    ? 'border-border bg-background'
                    : 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {order.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium">
                      {order.data.vehicleYear} {order.data.vehicleMake} {order.data.vehicleModel}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setOrders((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>VIN: {order.data.vehicleVin || 'N/A'}</div>
                  <div>Revenue: ${order.data.revenue ?? 0}</div>
                  <div>From: {order.data.pickupCity}, {order.data.pickupState}</div>
                  <div>To: {order.data.deliveryCity}, {order.data.deliveryState}</div>
                  <div>Pickup: {order.data.pickupDate || 'N/A'}</div>
                  <div>Delivery: {order.data.deliveryDate || 'N/A'}</div>
                </div>

                {order.errors.length > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    {order.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="outline" onClick={() => { reset(); setStep('upload') }}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={confirming || validCount === 0}>
                {confirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${validCount} Order${validCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Result Step */}
        {step === 'result' && importResult && (
          <div className="flex-1 space-y-4">
            {importResult.created.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {importResult.created.length} order{importResult.created.length !== 1 ? 's' : ''} imported
                  </p>
                </div>
                <ul className="space-y-1">
                  {importResult.created.map((name, i) => (
                    <li key={i} className="text-xs text-emerald-600 dark:text-emerald-400">{name}</li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ul className="space-y-1">
                  {importResult.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-600 dark:text-red-400">{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
