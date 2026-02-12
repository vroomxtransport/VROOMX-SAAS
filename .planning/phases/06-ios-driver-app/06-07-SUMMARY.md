# Phase 6 Plan 07: Order Detail View Summary

**One-liner:** Order detail with 7-step timeline, status transitions, ETA DatePicker, map links, contact actions, and file grid with offline upload

## What Was Built

### Task 1: OrderDetailView with Status Updates and ETA
**Commit:** `6cc43fa`
**Files created:**
- `VroomXDriver/Views/Orders/OrderDetailView.swift` - Full order detail ScrollView with 9 sections: header (order number + status badge), vehicle info card (VIN + type + color dot), delivery timeline, status action buttons, pickup section, delivery section, financial section (read-only), files section, notes section, and inspection actions
- `VroomXDriver/Views/Orders/TimelineView.swift` - 7-step vertical timeline (Order Created, Assigned to Trip, Pickup Inspection, Picked Up, In Transit, Delivery Inspection, Delivered) with color-coded states (green=complete, blue=active, gray=pending) and connecting lines
- `VroomXDriver/Views/Orders/ETAButton.swift` - Inline button showing current ETA or "Set ETA", opens DatePicker sheet for date+time selection, calls DataManager.submitETA on confirm

**Key implementation details:**
- Status buttons: assigned->"Mark Picked Up" (brandPrimary), picked_up->"Mark Delivered" (brandSuccess)
- Confirmation alert before any status change with error handling and loading state
- OrderStatus.level computed property for timeline comparison (new=0, assigned=1, picked_up=2, delivered=3, etc.)
- ISO8601 date parsing with 2-step fallback (with/without fractional seconds)
- Vehicle color mapping from string names to SwiftUI Color for color dot display
- Inspection section shows "Start Pickup/Delivery Inspection" or "View Inspection" based on state
- Inspection actions are placeholders -- NavigationLink to InspectionView deferred to Plans 08-09

### Task 2: MapLinkButton, ContactActionSheet, FileManagementGrid
**Commit:** `8674a27` (committed alongside 06-13 docs due to parallel execution)
**Files created:**
- `VroomXDriver/Views/Orders/MapLinkButton.swift` - URL-encodes address, tries Google Maps (`comgooglemaps://?q=`) via canOpenURL, falls back to Apple Maps (`maps://?q=`)
- `VroomXDriver/Views/Shared/ContactActionSheet.swift` - Shows name + phone with 3 action buttons (call via `tel:`, SMS via `sms:`, copy with haptic feedback + 1.5s checkmark visual feedback); hides entirely when phone is nil
- `VroomXDriver/Views/Orders/FileManagementGrid.swift` - Fetches `order_attachments` from Supabase, 2-column LazyVGrid, file type icons (PDF red, receipt amber, photo blue, doc violet), PhotosPicker for adding images, upload queued via InspectionUploadQueue for offline resilience, pending upload status indicators, full-screen preview sheet with AsyncImage

**Key implementation details:**
- FileManagementGrid defines OrderAttachment and OrderAttachmentInsert Codable models
- Upload flow: save locally -> add to pendingUploads UI -> enqueue InspectionUploadQueue -> attempt direct upload to bol-documents bucket -> create order_attachments record -> refresh grid
- PendingUpload model tracks upload/failed status for UI indicators
- AttachmentPreviewSheet detects image types and loads from Supabase Storage public URL
- Phone number cleaning strips spaces, dashes, parentheses before tel:/sms: URLs

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| OrderStatus.level extension for timeline comparison | Numeric levels enable >= comparisons instead of switch statements |
| 2-step ISO8601 parsing (with/without fractional seconds) | Supabase timestamps may or may not include fractional seconds |
| Inspection actions as placeholders (not NavigationLinks) | InspectionView doesn't exist yet; avoids broken references until Plans 08-09 |
| FileManagementGrid dual upload path (queue + direct) | InspectionUploadQueue provides offline resilience while direct upload provides immediate feedback |
| OrderAttachment model defined in FileManagementGrid.swift | Colocated with only consumer; can be extracted to Models/ if needed later |
| ContactActionSheet phone cleaning (strip formatting) | Phone numbers may have various formats; cleaned for reliable tel:/sms: URLs |

## Deviations from Plan

### Commit Attribution

**Task 2 files committed under 06-13 docs commit (8674a27):** Due to parallel execution with other plan agents, the three Task 2 files (MapLinkButton.swift, ContactActionSheet.swift, FileManagementGrid.swift) were included in a concurrent commit from the 06-13 plan agent. The files are identical to what was authored here and are correctly present in the repository. This is a commit attribution deviation only -- no code impact.

## Verification

- [x] OrderDetailView shows all order info (header, vehicle, timeline, pickup, delivery, financial, files, notes, inspections)
- [x] Status update buttons: assigned->"Mark Picked Up", picked_up->"Mark Delivered" with confirmation alerts
- [x] Timeline reflects current order state with 7 steps and color-coded indicators
- [x] ETA submission via DatePicker sheet calls DataManager.submitETA
- [x] MapLinkButton opens Google Maps (preferred) or Apple Maps (fallback)
- [x] ContactActionSheet has call/SMS/copy actions with haptic feedback
- [x] FileManagementGrid displays attachments and supports photo upload via InspectionUploadQueue
- [x] All files compile cleanly with `swift build`

## Next Phase Readiness

All order detail components are in place. Plans 08-09 (Inspection Flow) can wire NavigationLinks to the inspection action placeholders in OrderDetailView. The FileManagementGrid's upload pattern via InspectionUploadQueue establishes the reusable offline upload flow for inspection media.

---
**Duration:** ~5 minutes
**Completed:** 2026-02-12
