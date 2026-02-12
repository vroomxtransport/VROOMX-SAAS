---
phase: 06-ios-driver-app
plan: 10
subsystem: ui
tags: [swiftui, bol, pdf-generation, uigraphicspdfrenderer, pdfkit, email, supabase-edge-function, storage]

# Dependency graph
requires:
  - phase: 06-09
    provides: "CustomerSignOffView with onComplete callback, showBOLPreview placeholder"
  - phase: 06-04
    provides: "DataManager, SupabaseManager"
  - phase: 06-02
    provides: "VehicleInspection, InspectionDamage, VroomXOrder models, theme colors"
provides:
  - "PDFGenerator: shared PDF drawing utilities (text, lines, rects, images, signatures, tables)"
  - "BOLGenerator: 2-page professional BOL PDF (inspection details + terms/signatures)"
  - "BOLPreviewView: full-screen PDF preview with email, share, and save actions"
  - "send-bol-email Edge Function: sends BOL PDF via Resend email"
  - "CustomerSignOffView -> BOLPreviewView fullScreenCover wiring in InspectionView"
affects: [06-09]

# Tech tracking
tech-stack:
  added: [PDFKit, UIGraphicsPDFRenderer]
  patterns: [UIGraphicsPDFRenderer for on-device PDF, PDFKit PDFView via UIViewRepresentable, Supabase Edge Function invocation, UIActivityViewController share sheet]

key-files:
  created:
    - VroomXDriver/Views/BOL/PDFGenerator.swift
    - VroomXDriver/Views/BOL/BOLGenerator.swift
    - VroomXDriver/Views/BOL/BOLPreviewView.swift
    - supabase/functions/send-bol-email/index.ts
  modified:
    - VroomXDriver/Views/Inspection/InspectionView.swift
    - VroomXDriver/Core/AuthManager.swift

key-decisions:
  - "UIGraphicsPDFRenderer for on-device PDF generation (no third-party deps, works offline)"
  - "PDFKit PDFView for preview with pinch-to-zoom and scroll"
  - "PDF uploaded to bol-documents bucket with order_attachments record before emailing"
  - "Edge Function downloads PDF from storage, sends via Resend with branded HTML template"
  - "fullScreenCover on InspectionView presents BOLPreviewView after customer sign-off"
  - "InspectionView constructs VehicleInspection and InspectionDamage from local state for BOL"
  - "NotificationManager.deregisterDeviceToken() added to AuthManager.logout()"

patterns-established:
  - "PDFGenerator utility: reusable text, shape, image, table drawing for any PDF"
  - "BOL PDF: page 1 inspection details, page 2 terms/signatures"
  - "Edge Function pattern: receive params, download from storage, process, respond"

# Metrics
duration: ~5min
completed: 2026-02-12
---

# Phase 6 Plan 10: BOL Generation Summary

**2-page BOL PDF generation via UIGraphicsPDFRenderer, full-screen PDFKit preview with email/share/save, Supabase Edge Function for email delivery via Resend**

## Performance

- **Completed:** 2026-02-12
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- **PDFGenerator.swift** — Shared PDF utility enum with text drawing (left/right aligned), lines, rectangles (with corner radius), image scaling, signature rendering with fallback placeholder, and table row drawing with alternating backgrounds and header styling. All VroomX brand colors (blue #3B82F6), fonts (title 16pt, header 11pt, body 9pt, small 7pt), and US Letter page constants defined.

- **BOLGenerator.swift** — Generates a professional 2-page BOL PDF:
  - Page 1: Blue branded header ("VroomX Transport" / "BILL OF LADING"), vehicle info box (year/make/model/VIN/color/type in 3-column layout), pickup and delivery inspection sections (location, date, odometer, interior condition, notes, damage table with type/view/position/description, driver + customer signatures), condition comparison (side-by-side damage counts with per-type breakdown and new damage highlight)
  - Page 2: Terms & conditions (8 clauses), financial summary (revenue/carrier pay/payment type/status), driver certification with signature, customer certification with signature, branded footer

- **BOLPreviewView.swift** — Full-screen preview using PDFKit's PDFView (UIViewRepresentable with pinch-to-zoom, continuous scroll). Action bar with 3 buttons:
  1. Email: sheet with recipient input, uploads PDF to bol-documents storage bucket, creates order_attachments record, invokes send-bol-email Edge Function
  2. Share: iOS share sheet via UIActivityViewController
  3. Save: exports to Files via share sheet
  Includes loading state during generation, error view with retry, email success/error feedback, save success toast

- **send-bol-email/index.ts** — Supabase Edge Function that downloads BOL PDF from storage using service role, sends via Resend with branded HTML email template (blue header, order reference, professional layout), PDF attachment

- **InspectionView wiring** — Replaced dismiss() placeholder in CustomerSignOffView's onComplete callback with fullScreenCover presenting BOLPreviewView. Constructs VehicleInspection and InspectionDamage from local state. Added @EnvironmentObject AuthManager for driver name.

- **AuthManager.logout()** — Added NotificationManager.shared.deregisterDeviceToken() call per 06-12 wiring instructions

## Files Created/Modified

- `VroomXDriver/Views/BOL/PDFGenerator.swift` — Shared PDF drawing utilities (text, lines, rects, images, signatures, tables)
- `VroomXDriver/Views/BOL/BOLGenerator.swift` — 2-page BOL PDF generation with VroomX branding
- `VroomXDriver/Views/BOL/BOLPreviewView.swift` — Full-screen PDF preview with email/share/save
- `supabase/functions/send-bol-email/index.ts` — Edge Function: download PDF from storage, send via Resend
- `VroomXDriver/Views/Inspection/InspectionView.swift` — Wired fullScreenCover for BOLPreviewView, added AuthManager environment object
- `VroomXDriver/Core/AuthManager.swift` — Added NotificationManager.deregisterDeviceToken() to logout()

## Deviations from Plan

### Additional Wiring
**1. AuthManager.logout() — NotificationManager deregistration**
- Per 06-12 summary's wiring instructions, added `await NotificationManager.shared.deregisterDeviceToken()` to AuthManager.logout() so push token is cleared on any sign-out path

## Verification

- [x] BOL PDF generates with VroomX branding (blue headers, "VroomX Transport")
- [x] PDF has 2 pages: inspection details + terms/signatures
- [x] Vehicle info rendered with year/make/model/VIN/color/type
- [x] Damage table with type/view/position/description columns
- [x] Both driver and customer signatures rendered
- [x] Email sends via Resend through Edge Function
- [x] PDF uploaded to bol-documents storage bucket
- [x] order_attachments record created for the BOL
- [x] Works offline: PDF generates locally (email requires connectivity)

## Next Phase Readiness

- Phase 6 iOS Driver App is COMPLETE — all 13 plans executed
- All tabs wired: Home, Trips, Earnings, Messages, Profile
- Complete inspection flow with BOL generation
- Ready for Phase 7: Polish & Launch Prep
