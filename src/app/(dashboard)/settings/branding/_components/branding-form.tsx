'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { HexColorPicker } from 'react-colorful'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  Palette,
  Camera,
  Loader2,
  Trash2,
  Upload,
  FileText,
  Eye,
  Check,
  X,
} from 'lucide-react'
import { updateBranding, uploadLogo, deleteLogo, uploadBanner, deleteBanner } from '@/app/actions/tenant-settings'
import { Briefcase, ImageIcon } from 'lucide-react'

interface BrandingFormProps {
  tenantName: string
  initialLogoUrl: string | null
  initialBrandColorPrimary: string
  initialBrandColorSecondary: string
  initialInvoiceHeaderText: string
  initialInvoiceFooterText: string
  initialBannerUrl?: string | null
  initialAppWelcomeMessage?: string
  initialAppFooterText?: string
  initialAppEstimatedTime?: string
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

function isValidHex(value: string): boolean {
  return value === '' || HEX_REGEX.test(value)
}

const BRAND_PRESETS = [
  { name: 'Midnight', hex: '#0F172A' },
  { name: 'Navy',     hex: '#1E3A8A' },
  { name: 'Cobalt',   hex: '#1D4ED8' },
  { name: 'Teal',     hex: '#0F766E' },
  { name: 'Forest',   hex: '#166534' },
  { name: 'Emerald',  hex: '#047857' },
  { name: 'Amber',    hex: '#D97706' },
  { name: 'Orange',   hex: '#FB7232' },
  { name: 'Rust',     hex: '#B45309' },
  { name: 'Crimson',  hex: '#B91C1C' },
] as const

function matchPresetName(hex: string): string {
  const normalized = hex.toLowerCase()
  const match = BRAND_PRESETS.find((p) => p.hex.toLowerCase() === normalized)
  return match?.name ?? 'Custom'
}

export function BrandingForm({
  tenantName,
  initialLogoUrl,
  initialBrandColorPrimary,
  initialBrandColorSecondary,
  initialInvoiceHeaderText,
  initialInvoiceFooterText,
  initialBannerUrl,
  initialAppWelcomeMessage,
  initialAppFooterText,
  initialAppEstimatedTime,
}: BrandingFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

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

  // Application branding state
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl ?? null)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerDeleting, setBannerDeleting] = useState(false)
  const [isBannerDragOver, setIsBannerDragOver] = useState(false)
  const [appWelcomeMessage, setAppWelcomeMessage] = useState(initialAppWelcomeMessage ?? '')
  const [appFooterText, setAppFooterText] = useState(initialAppFooterText ?? '')
  const [appEstimatedTime, setAppEstimatedTime] = useState(initialAppEstimatedTime ?? '15-20 minutes')

  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

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

    try {
      const fd = new FormData()
      fd.append('logo', file)

      const result = await uploadLogo(fd)

      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to upload logo.')
        setLogoUrl(initialLogoUrl)
      } else {
        toast.success('Logo uploaded successfully.')
      }
    } catch {
      toast.error('Failed to upload logo. Please try again.')
      setLogoUrl(initialLogoUrl)
    } finally {
      setLogoUploading(false)
    }
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

  // ── Banner upload ────────────────────────────────────────────────────────────
  async function handleBannerUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('File must be a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.')
      return
    }

    setBannerUploading(true)
    const objectUrl = URL.createObjectURL(file)
    setBannerUrl(objectUrl)

    try {
      const fd = new FormData()
      fd.append('banner', file)

      const result = await uploadBanner(fd)
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true
      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to upload banner.'
        toast.error(msg)
        setBannerUrl(initialBannerUrl ?? null)
        URL.revokeObjectURL(objectUrl)
        return
      }
      // Replace the ephemeral blob URL with the real signed URL so the preview
      // survives a remount. Fall back to initialBannerUrl if the server didn't
      // return one (shouldn't happen, but keep a safety net).
      const signedUrl =
        'signedUrl' in result && typeof result.signedUrl === 'string'
          ? result.signedUrl
          : null
      URL.revokeObjectURL(objectUrl)
      setBannerUrl(signedUrl ?? initialBannerUrl ?? null)
      toast.success('Banner uploaded successfully.')
      // Re-render parent RSC so initialBannerUrl reflects the saved path.
      router.refresh()
    } catch (err) {
      console.error('[uploadBanner client] threw', err)
      toast.error('Failed to upload banner. Please try again.')
      setBannerUrl(initialBannerUrl ?? null)
      URL.revokeObjectURL(objectUrl)
    } finally {
      setBannerUploading(false)
    }
  }

  function handleBannerInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleBannerUpload(file)
    e.target.value = ''
  }

  const handleBannerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBannerDragOver(true)
  }, [])

  const handleBannerDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBannerDragOver(false)
  }, [])

  const handleBannerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBannerDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleBannerUpload(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDeleteBanner() {
    if (!confirm('Remove the application banner? This cannot be undone.')) return
    setBannerDeleting(true)
    const result = await deleteBanner()
    const ok =
      !!result &&
      typeof result === 'object' &&
      'success' in result &&
      result.success === true
    if (!ok) {
      const msg =
        result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error
          : 'Failed to remove banner.'
      toast.error(msg)
    } else {
      toast.success('Banner removed.')
      setBannerUrl(null)
      router.refresh()
    }
    setBannerDeleting(false)
  }

  // ── Color helpers ────────────────────────────────────────────────────────────
  function handlePrimaryColorText(e: React.ChangeEvent<HTMLInputElement>) {
    setPrimaryColor(e.target.value)
  }

  function handleSecondaryColorText(e: React.ChangeEvent<HTMLInputElement>) {
    setSecondaryColor(e.target.value)
  }

  function applyPreset(hex: string) {
    setPrimaryColor(hex)
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
      appWelcomeMessage: appWelcomeMessage,
      appFooterText: appFooterText,
      appEstimatedTime: appEstimatedTime,
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
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
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

        <CardContent className="px-6 pt-6 pb-6">
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
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
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

        <CardContent className="px-6 pt-6 pb-6 space-y-7">
          {/* ── Primary color ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Primary Color
              </Label>
              <p className="text-xs text-muted-foreground">
                Main accent on invoices, documents, and branded exports
              </p>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-4 text-left rounded-lg p-2 -ml-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Change primary color, currently ${primaryColor || '#1A2B3F'}`}
                >
                  <div
                    className="h-[52px] w-[52px] shrink-0 rounded-md border border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform group-active:scale-[0.97]"
                    style={{ backgroundColor: effectivePrimary }}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-lg font-medium tracking-tight uppercase text-foreground">
                      {primaryColor || '#1A2B3F'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {matchPresetName(effectivePrimary)}
                    </span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <HexColorPicker color={effectivePrimary} onChange={setPrimaryColor} />
                <Input
                  value={primaryColor}
                  onChange={handlePrimaryColorText}
                  placeholder="#1a2b3f"
                  maxLength={7}
                  aria-label="Primary color hex value"
                  className={[
                    'font-mono uppercase mt-3',
                    primaryColor && !isValidHex(primaryColor) ? 'border-destructive' : '',
                  ].join(' ')}
                />
                {primaryColor && !isValidHex(primaryColor) && (
                  <p className="text-xs text-destructive mt-1.5">
                    Must be a valid 6-digit hex color
                  </p>
                )}
              </PopoverContent>
            </Popover>

            {/* Preset swatches */}
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Presets
              </Label>
              <div className="grid grid-cols-5 gap-2.5">
                {BRAND_PRESETS.map((preset) => {
                  const isActive = preset.hex.toLowerCase() === effectivePrimary.toLowerCase()
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => applyPreset(preset.hex)}
                      aria-label={`Set primary color to ${preset.name} (${preset.hex})`}
                      aria-pressed={isActive}
                      title={`${preset.name} · ${preset.hex}`}
                      className={[
                        'group relative h-10 rounded-md border border-border/60',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                        'transition-all duration-150 active:scale-[0.94]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isActive
                          ? 'ring-2 ring-offset-2 ring-foreground/80'
                          : 'hover:ring-1 hover:ring-offset-1 hover:ring-foreground/30',
                      ].join(' ')}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isActive && (
                        <Check
                          className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      )}
                      <span className="sr-only">{preset.name}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Click a preset or open the picker for custom colors
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* ── Secondary color ────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Secondary Color{' '}
                <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                  (optional)
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Used for subtle accents and dividers on invoices
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group flex items-center gap-4 text-left rounded-lg p-2 -ml-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Change secondary color, currently ${secondaryColor || 'unset'}`}
                  >
                    <div
                      className={[
                        'relative h-[52px] w-[52px] shrink-0 rounded-md transition-transform group-active:scale-[0.97]',
                        secondaryColor
                          ? 'border border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                          : 'border border-dashed border-border bg-muted/60',
                      ].join(' ')}
                      style={secondaryColor ? { backgroundColor: effectiveSecondary } : undefined}
                    >
                      {!secondaryColor && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-lg font-light text-muted-foreground/60"
                          aria-hidden="true"
                        >
                          +
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-lg font-medium tracking-tight uppercase text-foreground">
                        {secondaryColor || 'Not set'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {secondaryColor ? matchPresetName(effectiveSecondary) : 'Click to add'}
                      </span>
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <HexColorPicker
                    color={effectiveSecondary}
                    onChange={setSecondaryColor}
                  />
                  <Input
                    value={secondaryColor}
                    onChange={handleSecondaryColorText}
                    placeholder="#6b7280"
                    maxLength={7}
                    aria-label="Secondary color hex value"
                    className={[
                      'font-mono uppercase mt-3',
                      secondaryColor && !isValidHex(secondaryColor) ? 'border-destructive' : '',
                    ].join(' ')}
                  />
                  {secondaryColor && !isValidHex(secondaryColor) && (
                    <p className="text-xs text-destructive mt-1.5">
                      Must be a valid 6-digit hex color
                    </p>
                  )}
                </PopoverContent>
              </Popover>

              {secondaryColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSecondaryColor('')}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Clear secondary color"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Invoice Text ───────────────────────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
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

        <CardContent className="px-6 pt-6 pb-6 space-y-5">
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
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
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

        <CardContent className="px-6 pt-6 pb-6">
          {/* Full-size invoice document on subtle paper background */}
          <div className="bg-[#f0f1f3] rounded-xl p-6 sm:p-8">
            <div
              className="mx-auto bg-white font-sans overflow-hidden"
              style={{
                boxShadow: 'rgba(50,50,93,0.12) 0px 30px 60px -12px, rgba(0,0,0,0.08) 0px 18px 36px -18px',
                border: '1px solid #e5edf5',
                borderRadius: '6px',
                /* US Letter aspect ratio: 8.5 x 11 */
                maxWidth: '680px',
                minHeight: '880px',
              }}
              role="img"
              aria-label="Invoice preview"
            >
              {/* Accent bar */}
              <div className="h-1 w-full" style={{ backgroundColor: effectivePrimary }} />

              <div className="flex flex-col justify-between" style={{ minHeight: '876px' }}>
                <div className="px-8 sm:px-12 pt-10">
                  {/* ── Header: company + invoice meta ── */}
                  <div className="flex items-start justify-between gap-8 mb-10">
                    <div className="flex-1 min-w-0">
                      {logoUrl && (
                        <div className="mb-3">
                          <Image
                            src={logoUrl}
                            alt="Logo preview"
                            width={140}
                            height={60}
                            className="object-contain object-left max-h-[60px]"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="text-base font-semibold text-[#0f172a]">
                        {tenantName || 'Your Company'}
                      </div>
                      {headerText && (
                        <div className="text-[13px] text-[#64748b] mt-1 leading-relaxed whitespace-pre-wrap max-w-xs">
                          {headerText}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                        style={{ color: effectivePrimary }}
                      >
                        Invoice
                      </div>
                      <div className="text-xl font-semibold text-[#0f172a] mb-3">#INV-001</div>
                      <div className="space-y-1 text-[13px]">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-[#64748b]">Issued</span>
                          <span className="text-[#475569] font-medium">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-[#64748b]">Due</span>
                          <span className="text-[#475569] font-medium">NET 30</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Divider ── */}
                  <div className="h-px bg-[#e5edf5] mb-8" />

                  {/* ── Bill To + Ship Info ── */}
                  <div className="grid grid-cols-2 gap-8 mb-10">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-2"
                        style={{ color: effectivePrimary }}
                      >
                        Bill To
                      </div>
                      <div className="text-sm font-medium text-[#0f172a]">National Auto Transport LLC</div>
                      <div className="text-[13px] text-[#64748b] mt-1 leading-relaxed">
                        1200 Commerce Blvd, Suite 400<br />
                        Jacksonville, FL 32256
                      </div>
                      <div className="text-[13px] text-[#64748b] mt-1">billing@nationalauto.com</div>
                    </div>
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-2"
                        style={{ color: effectivePrimary }}
                      >
                        Payment Details
                      </div>
                      <div className="space-y-1 text-[13px]">
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Method</span>
                          <span className="text-[#475569] font-medium">ACH / Wire</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Terms</span>
                          <span className="text-[#475569] font-medium">NET 30</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Status</span>
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Line items table ── */}
                  <div className="mb-8">
                    {/* Table header */}
                    <div
                      className="grid gap-4 px-4 py-2.5 rounded-md mb-1"
                      style={{
                        gridTemplateColumns: '2fr 1fr 1fr 100px',
                        backgroundColor: `${effectivePrimary}08`,
                      }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Vehicle</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Route</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">VIN</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b] text-right">Amount</span>
                    </div>

                    {/* Row 1 */}
                    <div className="grid gap-4 px-4 py-3.5 border-b border-[#f1f5f9]" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
                      <div>
                        <div className="text-sm font-medium text-[#0f172a]">2024 BMW X5 xDrive40i</div>
                        <div className="text-[12px] text-[#64748b] mt-0.5">Order #ORD-1847</div>
                      </div>
                      <div className="text-[13px] text-[#475569] self-center">Dallas, TX → Miami, FL</div>
                      <div className="text-[12px] text-[#64748b] font-mono self-center">5UX...G7F2</div>
                      <div className="text-sm font-medium text-[#0f172a] text-right tabular-nums self-center">$1,850.00</div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid gap-4 px-4 py-3.5 border-b border-[#f1f5f9]" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
                      <div>
                        <div className="text-sm font-medium text-[#0f172a]">2023 Mercedes-Benz GLE 450</div>
                        <div className="text-[12px] text-[#64748b] mt-0.5">Order #ORD-1848</div>
                      </div>
                      <div className="text-[13px] text-[#475569] self-center">Houston, TX → Atlanta, GA</div>
                      <div className="text-[12px] text-[#64748b] font-mono self-center">4JG...K9M1</div>
                      <div className="text-sm font-medium text-[#0f172a] text-right tabular-nums self-center">$1,275.00</div>
                    </div>

                    {/* Row 3 */}
                    <div className="grid gap-4 px-4 py-3.5 border-b border-[#f1f5f9]" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
                      <div>
                        <div className="text-sm font-medium text-[#0f172a]">2024 Tesla Model Y Long Range</div>
                        <div className="text-[12px] text-[#64748b] mt-0.5">Order #ORD-1849</div>
                      </div>
                      <div className="text-[13px] text-[#475569] self-center">Phoenix, AZ → Denver, CO</div>
                      <div className="text-[12px] text-[#64748b] font-mono self-center">7SA...N3P8</div>
                      <div className="text-sm font-medium text-[#0f172a] text-right tabular-nums self-center">$950.00</div>
                    </div>
                  </div>

                  {/* ── Summary block ── */}
                  <div className="flex justify-end mb-10">
                    <div className="w-64">
                      <div className="flex justify-between py-2 text-[13px]">
                        <span className="text-[#64748b]">Subtotal</span>
                        <span className="text-[#0f172a] font-medium tabular-nums">$4,075.00</span>
                      </div>
                      <div className="flex justify-between py-2 text-[13px] border-b border-[#e5edf5]">
                        <span className="text-[#64748b]">Broker Fee</span>
                        <span className="text-[#0f172a] font-medium tabular-nums">-$0.00</span>
                      </div>
                      <div
                        className="flex justify-between py-3 mt-1 rounded-md px-3 -mx-3"
                        style={{ backgroundColor: `${effectivePrimary}0a` }}
                      >
                        <span
                          className="text-sm font-bold uppercase tracking-[0.08em]"
                          style={{ color: effectivePrimary }}
                        >
                          Total Due
                        </span>
                        <span
                          className="text-lg font-bold tabular-nums"
                          style={{ color: effectivePrimary }}
                        >
                          $4,075.00
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Footer — pinned to bottom ── */}
                <div className="px-8 sm:px-12 pb-8">
                  <div className="h-px bg-[#e5edf5] mb-4" />
                  {footerText ? (
                    <div className="text-[13px] text-center text-[#64748b] leading-relaxed whitespace-pre-wrap">
                      {footerText}
                    </div>
                  ) : (
                    <div className="text-[13px] text-center text-[#94a3b8] italic">
                      Your footer text will appear here
                    </div>
                  )}
                  <div className="text-[11px] text-center text-[#94a3b8] mt-3">
                    Generated by {tenantName || 'Your Company'} via VroomX TMS
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Employment Application Branding ────────────────────── */}
      <Card className="widget-card !p-0 border-0 shadow-none">
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Employment Application</CardTitle>
              <CardDescription className="text-sm">
                Customize the branded welcome page drivers see when applying
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pt-6 pb-6 space-y-5">
          {/* Banner image upload */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Banner Image
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Hero image shown at the top of the application welcome page
            </p>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleBannerInputChange}
              aria-label="Upload banner"
            />

            {bannerUrl ? (
              <div className="relative w-full h-40 rounded-xl border border-border bg-muted/30 overflow-hidden group">
                <Image
                  src={bannerUrl}
                  alt="Application banner"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={bannerUploading || bannerDeleting}
                  >
                    {bannerUploading ? (
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
                    onClick={handleDeleteBanner}
                    disabled={bannerUploading || bannerDeleting}
                  >
                    {bannerDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1.5" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                onDragOver={handleBannerDragOver}
                onDragLeave={handleBannerDragLeave}
                onDrop={handleBannerDrop}
                disabled={bannerUploading}
                className={[
                  'w-full h-40 rounded-xl border-2 border-dashed transition-colors duration-150',
                  'flex flex-col items-center justify-center gap-2 cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isBannerDragOver
                    ? 'border-brand bg-brand/5'
                    : 'border-border hover:border-brand/60 hover:bg-muted/40',
                  bannerUploading ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {bannerUploading ? (
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {bannerUploading ? 'Uploading…' : 'Click to upload or drag and drop'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPEG, or WebP — max 5MB, recommended 1200x400
                </span>
              </button>
            )}
          </div>

          {/* Welcome message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="appWelcomeMessage">Welcome Message</Label>
              <span className="text-xs text-muted-foreground">{appWelcomeMessage.length}/500</span>
            </div>
            <Textarea
              id="appWelcomeMessage"
              value={appWelcomeMessage}
              onChange={(e) => setAppWelcomeMessage(e.target.value)}
              placeholder="Thank you for your interest in joining our team. Please complete the application below to get started."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Shown on the welcome page before the application form
            </p>
          </div>

          {/* Application footer text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="appFooterText">Application Footer</Label>
              <span className="text-xs text-muted-foreground">{appFooterText.length}/300</span>
            </div>
            <Textarea
              id="appFooterText"
              value={appFooterText}
              onChange={(e) => setAppFooterText(e.target.value)}
              placeholder="e.g. Equal Opportunity Employer · All information is kept strictly confidential"
              rows={2}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              Displayed at the bottom of the application form
            </p>
          </div>

          {/* Estimated time */}
          <div className="space-y-1.5">
            <Label htmlFor="appEstimatedTime">Estimated Completion Time</Label>
            <Input
              id="appEstimatedTime"
              value={appEstimatedTime}
              onChange={(e) => setAppEstimatedTime(e.target.value)}
              placeholder="15-20 minutes"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Shown on the welcome page so applicants know what to expect
            </p>
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
