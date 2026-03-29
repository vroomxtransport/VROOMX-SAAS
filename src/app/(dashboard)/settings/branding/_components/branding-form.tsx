'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import Image from 'next/image'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Palette,
  Camera,
  Loader2,
  Trash2,
  Upload,
  FileText,
  Eye,
} from 'lucide-react'
import { updateBranding, uploadLogo, deleteLogo } from '@/app/actions/tenant-settings'

interface BrandingFormProps {
  tenantName: string
  initialLogoUrl: string | null
  initialBrandColorPrimary: string
  initialBrandColorSecondary: string
  initialInvoiceHeaderText: string
  initialInvoiceFooterText: string
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

function isValidHex(value: string): boolean {
  return value === '' || HEX_REGEX.test(value)
}

export function BrandingForm({
  tenantName,
  initialLogoUrl,
  initialBrandColorPrimary,
  initialBrandColorSecondary,
  initialInvoiceHeaderText,
  initialInvoiceFooterText,
}: BrandingFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoDeleting, setLogoDeleting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Color state
  const [primaryColor, setPrimaryColor] = useState(initialBrandColorPrimary || '#1a2b3f')
  const [secondaryColor, setSecondaryColor] = useState(initialBrandColorSecondary || '')

  // Invoice text state
  const [headerText, setHeaderText] = useState(initialInvoiceHeaderText)
  const [footerText, setFooterText] = useState(initialInvoiceFooterText)

  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  // ── Logo upload ──────────────────────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('File must be a PNG, JPEG, WebP, or SVG image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.')
      return
    }

    setLogoUploading(true)
    // Optimistic preview
    const objectUrl = URL.createObjectURL(file)
    setLogoUrl(objectUrl)

    const fd = new FormData()
    fd.append('logo', file)

    const result = await uploadLogo(fd)

    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to upload logo.')
      // Revert optimistic update
      setLogoUrl(initialLogoUrl)
    } else {
      toast.success('Logo uploaded successfully.')
      // Keep the object URL for now; page revalidation will provide signed URL on next load
    }
    setLogoUploading(false)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    // Reset input so the same file can be re-selected after removal
    e.target.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDeleteLogo() {
    if (!confirm('Remove your company logo? This cannot be undone.')) return
    setLogoDeleting(true)
    const result = await deleteLogo()
    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to remove logo.')
    } else {
      toast.success('Logo removed.')
      setLogoUrl(null)
    }
    setLogoDeleting(false)
  }

  // ── Color helpers ────────────────────────────────────────────────────────────
  function handlePrimaryColorPicker(e: React.ChangeEvent<HTMLInputElement>) {
    setPrimaryColor(e.target.value)
  }

  function handlePrimaryColorText(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setPrimaryColor(val)
  }

  function handleSecondaryColorPicker(e: React.ChangeEvent<HTMLInputElement>) {
    setSecondaryColor(e.target.value)
  }

  function handleSecondaryColorText(e: React.ChangeEvent<HTMLInputElement>) {
    setSecondaryColor(e.target.value)
  }

  // ── Save branding (colors + text) ────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (primaryColor && !isValidHex(primaryColor)) {
      toast.error('Primary color must be a valid hex color (e.g. #1a2b3f).')
      return
    }
    if (secondaryColor && !isValidHex(secondaryColor)) {
      toast.error('Secondary color must be a valid hex color (e.g. #f5a623).')
      return
    }

    setSaving(true)
    const result = await updateBranding({
      brandColorPrimary: primaryColor || '',
      brandColorSecondary: secondaryColor || '',
      invoiceHeaderText: headerText,
      invoiceFooterText: footerText,
    })

    if ('error' in result && result.error) {
      if (typeof result.error === 'string') {
        toast.error(result.error)
      } else {
        toast.error('Please fix the validation errors.')
      }
    } else {
      startTransition(() => {
        toast.success('Branding saved successfully.')
      })
    }
    setSaving(false)
  }

  const effectivePrimary = isValidHex(primaryColor) ? primaryColor : '#1a2b3f'
  const effectiveSecondary = isValidHex(secondaryColor) && secondaryColor ? secondaryColor : '#6b7280'

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* ── Section 1: Logo Upload ─────────────────────────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Company Logo</CardTitle>
              <CardDescription className="text-sm">
                Appears on invoices and customer-facing documents
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileInputChange}
            aria-label="Upload logo"
          />

          {logoUrl ? (
            /* ── Has logo: preview with overlay actions ── */
            <div className="relative w-full h-48 rounded-xl border border-border bg-muted/30 overflow-hidden group">
              <Image
                src={logoUrl}
                alt="Company logo"
                fill
                className="object-contain p-4"
                unoptimized
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading || logoDeleting}
                >
                  {logoUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1.5" />
                  )}
                  Change
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteLogo}
                  disabled={logoUploading || logoDeleting}
                >
                  {logoDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1.5" />
                  )}
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            /* ── No logo: dropzone ── */
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={logoUploading}
              className={[
                'w-full h-48 rounded-xl border-2 border-dashed transition-colors duration-150',
                'flex flex-col items-center justify-center gap-2 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isDragOver
                  ? 'border-brand bg-brand/5'
                  : 'border-border hover:border-brand/60 hover:bg-muted/40',
                logoUploading ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {logoUploading ? (
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              ) : (
                <Camera className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {logoUploading ? 'Uploading…' : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, or SVG — max 5MB
              </span>
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Brand Colors ───────────────────────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Brand Colors</CardTitle>
              <CardDescription className="text-sm">
                Used as accent colors on invoices and documents
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-5">
          {/* Primary color row */}
          <div className="space-y-1.5">
            <Label htmlFor="primaryColorText">Primary Color</Label>
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 shrink-0 rounded-md border border-input overflow-hidden">
                <input
                  type="color"
                  value={isValidHex(primaryColor) ? primaryColor : '#1a2b3f'}
                  onChange={handlePrimaryColorPicker}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  aria-label="Primary color picker"
                />
                <div
                  className="absolute inset-0 rounded-md"
                  style={{ backgroundColor: isValidHex(primaryColor) ? primaryColor : '#1a2b3f' }}
                />
              </div>
              <Input
                id="primaryColorText"
                value={primaryColor}
                onChange={handlePrimaryColorText}
                placeholder="#1a2b3f"
                maxLength={7}
                className={[
                  'font-mono uppercase',
                  primaryColor && !isValidHex(primaryColor) ? 'border-destructive' : '',
                ].join(' ')}
              />
            </div>
            {primaryColor && !isValidHex(primaryColor) && (
              <p className="text-xs text-destructive">Must be a valid 6-digit hex color (e.g. #1a2b3f)</p>
            )}
          </div>

          {/* Secondary color row */}
          <div className="space-y-1.5">
            <Label htmlFor="secondaryColorText">Secondary Color <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 shrink-0 rounded-md border border-input overflow-hidden">
                <input
                  type="color"
                  value={isValidHex(secondaryColor) && secondaryColor ? secondaryColor : '#6b7280'}
                  onChange={handleSecondaryColorPicker}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  aria-label="Secondary color picker"
                />
                <div
                  className="absolute inset-0 rounded-md"
                  style={{ backgroundColor: isValidHex(secondaryColor) && secondaryColor ? secondaryColor : '#6b7280' }}
                />
              </div>
              <Input
                id="secondaryColorText"
                value={secondaryColor}
                onChange={handleSecondaryColorText}
                placeholder="#6b7280"
                maxLength={7}
                className={[
                  'font-mono uppercase',
                  secondaryColor && !isValidHex(secondaryColor) ? 'border-destructive' : '',
                ].join(' ')}
              />
            </div>
            {secondaryColor && !isValidHex(secondaryColor) && (
              <p className="text-xs text-destructive">Must be a valid 6-digit hex color (e.g. #f5a623)</p>
            )}
          </div>

          {/* Live color swatches */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-16 rounded-md border border-border shadow-sm"
                style={{ backgroundColor: effectivePrimary }}
                aria-label={`Primary color swatch: ${effectivePrimary}`}
              />
              <span className="text-xs text-muted-foreground">Primary</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-16 rounded-md border border-border shadow-sm"
                style={{ backgroundColor: effectiveSecondary }}
                aria-label={`Secondary color swatch: ${effectiveSecondary}`}
              />
              <span className="text-xs text-muted-foreground">Secondary</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Invoice Text ───────────────────────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Invoice Text</CardTitle>
              <CardDescription className="text-sm">
                Custom text shown at the top and bottom of every invoice you send
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="invoiceHeaderText">Header Text</Label>
              <span className="text-xs text-muted-foreground">{headerText.length}/500</span>
            </div>
            <Textarea
              id="invoiceHeaderText"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="e.g. Licensed & Bonded Auto Hauler · DOT #1234567"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Appears below your company name in the invoice header
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="invoiceFooterText">Footer Text</Label>
              <span className="text-xs text-muted-foreground">{footerText.length}/500</span>
            </div>
            <Textarea
              id="invoiceFooterText"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Payment due within 30 days · Questions? Call (555) 123-4567"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Appears at the bottom of every invoice
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Invoice Preview ────────────────────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Invoice Preview</CardTitle>
              <CardDescription className="text-sm">
                Live preview showing how your branding appears on invoices
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 flex justify-center">
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-[11px] font-sans"
            role="img"
            aria-label="Invoice preview"
          >
            {/* Invoice header bar */}
            <div
              className="h-1.5 w-full"
              style={{ backgroundColor: effectivePrimary }}
            />

            <div className="p-5">
              {/* Company header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  {logoUrl && (
                    <div className="mb-2">
                      <Image
                        src={logoUrl}
                        alt="Logo preview"
                        width={80}
                        height={40}
                        className="object-contain object-left"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="font-bold text-slate-900 text-sm truncate">{tenantName || 'Your Company'}</div>
                  {headerText && (
                    <div className="text-slate-500 mt-0.5 leading-relaxed whitespace-pre-wrap line-clamp-2">
                      {headerText}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-base font-bold"
                    style={{ color: effectivePrimary }}
                  >
                    INVOICE
                  </div>
                  <div className="text-slate-500">#INV-001</div>
                  <div className="text-slate-500">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-200 mb-3" />

              {/* Bill to */}
              <div className="mb-3">
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: effectivePrimary }}
                >
                  Bill To
                </div>
                <div className="text-slate-700">Sample Broker Co.</div>
              </div>

              {/* Line items */}
              <div className="mb-3">
                <div className="flex justify-between text-slate-500 pb-1 border-b border-slate-100">
                  <span className="font-semibold">Description</span>
                  <span className="font-semibold">Amount</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700">2024 BMW X5 · Dallas → Miami</span>
                  <span className="text-slate-900 font-medium">$1,850.00</span>
                </div>
              </div>

              {/* Total */}
              <div
                className="flex justify-between font-bold text-sm py-1.5 border-t-2"
                style={{ borderColor: effectivePrimary, color: effectivePrimary }}
              >
                <span>Total Due</span>
                <span>$1,850.00</span>
              </div>

              {/* Footer */}
              {footerText ? (
                <div className="mt-4 pt-3 border-t border-slate-100 text-center text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {footerText}
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-100 text-center text-slate-300 italic">
                  Your footer text will appear here
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Branding'
          )}
        </Button>
      </div>
    </form>
  )
}
