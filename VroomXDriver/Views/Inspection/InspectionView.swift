import SwiftUI
import Supabase

// MARK: - Inspection View (6-Step Flow Controller)

/// Main inspection flow controller that manages the 6-step inspection process.
/// Takes an order and inspection type (pickup/delivery), creates a vehicle_inspections
/// record, and progresses through: Photos -> Video -> Exterior -> Notes -> Review -> Sign Off.
struct InspectionView: View {
    let order: VroomXOrder
    let inspectionType: InspectionType

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authManager: AuthManager

    // MARK: - Flow State

    @State private var currentStep: InspectionStep = .photos
    @State private var inspectionId: String?
    @State private var isCreatingRecord = false
    @State private var showDiscardAlert = false
    @State private var errorMessage: String?

    // MARK: - Inspection Data (local state until completion)

    /// Photos captured for each photo type slot.
    @State private var capturedPhotos: [PhotoType: CapturedPhoto] = [:]

    /// Whether a walkthrough video has been recorded.
    @State private var videoRecorded = false

    /// Local path of the recorded video file.
    @State private var videoLocalPath: String?

    /// Duration of the recorded video in seconds.
    @State private var videoDuration: TimeInterval = 0

    /// Damages marked on the exterior diagram.
    @State private var damages: [LocalDamage] = []

    /// Notes entered by the driver.
    @State private var inspectionNotes: String = ""

    /// Odometer reading entered by the driver.
    @State private var odometerReading: String = ""

    /// Interior condition rating.
    @State private var interiorCondition: InteriorCondition = .good

    /// GPS location data captured during notes step.
    @State private var gpsLatitude: Double?
    @State private var gpsLongitude: Double?
    @State private var gpsAddress: String?

    /// Driver signature image (step 5).
    @State private var driverSignatureImage: UIImage?

    /// Customer data (step 6).
    @State private var customerName: String = ""
    @State private var customerNotes: String = ""
    @State private var customerSignatureImage: UIImage?

    /// Whether customer review is showing sign-off substep.
    @State private var showCustomerSignOff = false

    /// Completion state for BOL navigation placeholder.
    @State private var showBOLPreview = false
    @State private var completedInspectionId: String?

    // MARK: - Computed

    /// Whether the current step allows advancing to next.
    private var canAdvance: Bool {
        switch currentStep {
        case .photos:
            return requiredPhotosComplete
        case .video:
            return videoRecorded
        case .exterior:
            return true // Exterior is always advanceable (no damage = no damage)
        case .notes:
            return true // Notes are optional, GPS auto-captures
        case .driverReview:
            return false // Step 5 manages its own "Sign & Continue" button
        case .customerReview:
            return false // Step 6 manages its own sign-off flow
        }
    }

    /// Whether all 7 required photos have been captured.
    private var requiredPhotosComplete: Bool {
        let requiredTypes: [PhotoType] = [.odometer, .front, .left, .right, .rear, .top, .key_vin]
        return requiredTypes.allSatisfy { capturedPhotos[$0] != nil }
    }

    /// Count of captured photos (total).
    private var capturedPhotoCount: Int {
        capturedPhotos.count
    }

    /// Whether there is any data that would be lost on dismiss.
    private var hasUnsavedData: Bool {
        !capturedPhotos.isEmpty || videoRecorded || !damages.isEmpty || !inspectionNotes.isEmpty || !odometerReading.isEmpty || driverSignatureImage != nil
    }

    /// Whether the bottom navigation buttons should be shown for the current step.
    /// Steps 5 and 6 have their own advancement buttons.
    private var showNavigationButtons: Bool {
        currentStep != .driverReview && currentStep != .customerReview
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Step progress indicator
                stepIndicator
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                Divider()

                // Step content
                stepContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Navigation buttons (hidden for steps 5 and 6 which manage their own flow)
                if showNavigationButtons {
                    Divider()

                    navigationButtons
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                }
            }
            .background(Color.appBackground)
            .navigationTitle("\(inspectionType.displayName) Inspection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        if hasUnsavedData {
                            showDiscardAlert = true
                        } else {
                            dismiss()
                        }
                    }
                    .foregroundColor(.brandDanger)
                }
            }
            .alert("Discard Inspection?", isPresented: $showDiscardAlert) {
                Button("Discard", role: .destructive) {
                    dismiss()
                }
                Button("Continue Editing", role: .cancel) {}
            } message: {
                Text("You have unsaved inspection data. This will be lost if you discard.")
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                if let errorMessage {
                    Text(errorMessage)
                }
            }
            .task {
                await createOrLoadInspection()
            }
            .fullScreenCover(isPresented: $showBOLPreview) {
                // Dismiss inspection flow after BOL preview is closed
                dismiss()
            } content: {
                if let completedInspectionId {
                    BOLPreviewView(
                        inspectionId: completedInspectionId,
                        order: order,
                        inspection: VehicleInspection(
                            id: completedInspectionId,
                            tenantId: order.tenantId,
                            orderId: order.id,
                            driverId: DataManager.shared.driverId ?? "",
                            inspectionType: inspectionType,
                            status: .completed,
                            odometerReading: Int(odometerReading),
                            interiorCondition: interiorCondition.rawValue,
                            notes: inspectionNotes.isEmpty ? nil : inspectionNotes,
                            gpsLatitude: gpsLatitude,
                            gpsLongitude: gpsLongitude,
                            gpsAddress: gpsAddress,
                            driverSignatureUrl: nil,
                            customerSignatureUrl: nil,
                            customerName: customerName.isEmpty ? nil : customerName,
                            customerNotes: customerNotes.isEmpty ? nil : customerNotes,
                            completedAt: ISO8601DateFormatter().string(from: Date()),
                            createdAt: "",
                            updatedAt: ""
                        ),
                        damages: damages.map { local in
                            InspectionDamage(
                                id: local.id,
                                tenantId: order.tenantId,
                                inspectionId: completedInspectionId,
                                damageType: local.damageType,
                                view: local.view,
                                xPosition: local.xPosition,
                                yPosition: local.yPosition,
                                description: local.description,
                                createdAt: ""
                            )
                        },
                        driverSignatureImage: driverSignatureImage,
                        customerSignatureImage: customerSignatureImage,
                        driverName: authManager.currentDriver?.fullName ?? "Driver"
                    )
                }
            }
        }
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        VStack(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(InspectionStep.allCases) { step in
                    if step.rawValue > 0 {
                        // Connector line
                        Rectangle()
                            .fill(step.rawValue <= currentStep.rawValue ? Color.brandPrimary : Color.textSecondary.opacity(0.3))
                            .frame(height: 2)
                    }

                    // Step circle
                    ZStack {
                        Circle()
                            .fill(stepCircleColor(for: step))
                            .frame(width: 28, height: 28)

                        if step.rawValue < currentStep.rawValue {
                            // Completed - checkmark
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else if step == currentStep {
                            // Current - step number
                            Text("\(step.rawValue + 1)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else {
                            // Future - step number
                            Text("\(step.rawValue + 1)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
            }

            // Current step label
            Text(currentStep.displayName)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
        }
    }

    private func stepCircleColor(for step: InspectionStep) -> Color {
        if step.rawValue < currentStep.rawValue {
            return .brandSuccess
        } else if step == currentStep {
            return .brandPrimary
        } else {
            return .textSecondary.opacity(0.2)
        }
    }

    // MARK: - Step Content

    @ViewBuilder
    private var stepContent: some View {
        switch currentStep {
        case .photos:
            InspectionPhotoView(
                capturedPhotos: $capturedPhotos,
                inspectionId: inspectionId ?? ""
            )

        case .video:
            InspectionVideoCaptureView(
                videoRecorded: $videoRecorded,
                videoLocalPath: $videoLocalPath,
                videoDuration: $videoDuration,
                inspectionId: inspectionId ?? ""
            )

        case .exterior:
            ExteriorInspectionView(
                vehicleType: order.vehicleType ?? "sedan",
                damages: $damages
            )

        case .notes:
            InspectionNotesView(
                odometerReading: $odometerReading,
                interiorCondition: $interiorCondition,
                notes: $inspectionNotes,
                gpsLatitude: $gpsLatitude,
                gpsLongitude: $gpsLongitude,
                gpsAddress: $gpsAddress
            )

        case .driverReview:
            DriverReviewView(
                order: order,
                inspectionType: inspectionType,
                inspectionId: inspectionId ?? "",
                capturedPhotos: capturedPhotos,
                videoRecorded: videoRecorded,
                damages: damages,
                odometerReading: odometerReading,
                interiorCondition: interiorCondition,
                notes: inspectionNotes,
                gpsLatitude: gpsLatitude,
                gpsLongitude: gpsLongitude,
                gpsAddress: gpsAddress,
                driverSignatureImage: $driverSignatureImage,
                onSignAndContinue: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        currentStep = .customerReview
                    }
                }
            )

        case .customerReview:
            if showCustomerSignOff {
                CustomerSignOffView(
                    order: order,
                    inspectionId: inspectionId ?? "",
                    inspectionType: inspectionType,
                    capturedPhotos: capturedPhotos,
                    videoRecorded: videoRecorded,
                    videoLocalPath: videoLocalPath,
                    videoDuration: videoDuration,
                    damages: damages,
                    odometerReading: odometerReading,
                    interiorCondition: interiorCondition,
                    notes: inspectionNotes,
                    gpsLatitude: gpsLatitude,
                    gpsLongitude: gpsLongitude,
                    gpsAddress: gpsAddress,
                    driverSignatureImage: driverSignatureImage,
                    customerName: customerName,
                    customerNotes: customerNotes,
                    customerSignatureImage: $customerSignatureImage,
                    onComplete: { completedId in
                        completedInspectionId = completedId
                        showBOLPreview = true
                    }
                )
            } else {
                CustomerReviewView(
                    order: order,
                    capturedPhotos: capturedPhotos,
                    damages: damages,
                    odometerReading: odometerReading,
                    customerName: $customerName,
                    customerNotes: $customerNotes,
                    onProceedToSign: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showCustomerSignOff = true
                        }
                    }
                )
            }
        }
    }

    // MARK: - Navigation Buttons

    private var navigationButtons: some View {
        HStack(spacing: 12) {
            // Back button
            if currentStep.rawValue > 0 {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if let prev = InspectionStep(rawValue: currentStep.rawValue - 1) {
                            currentStep = prev
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandPrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.brandPrimary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            // Next/Finish button
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if let next = InspectionStep(rawValue: currentStep.rawValue + 1) {
                        currentStep = next
                    } else {
                        // Last step - would complete inspection (Plan 09)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(currentStep == .customerReview ? "Complete" : "Next")
                    if currentStep != .customerReview {
                        Image(systemName: "chevron.right")
                    }
                }
                .font(.vroomxBodyBold)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(canAdvance ? Color.brandPrimary : Color.textSecondary.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(!canAdvance)
        }
    }

    // MARK: - Inspection Record Management

    /// Creates a new vehicle_inspections record or loads an existing in_progress one.
    private func createOrLoadInspection() async {
        guard inspectionId == nil else { return }
        guard let driverId = DataManager.shared.driverId else {
            errorMessage = "Driver not configured. Please sign in again."
            return
        }

        isCreatingRecord = true
        defer { isCreatingRecord = false }

        let supabase = SupabaseManager.shared.client

        do {
            // Check for existing in_progress inspection for this order + type
            let existing: [VehicleInspection] = try await supabase
                .from("vehicle_inspections")
                .select()
                .eq("order_id", value: order.id)
                .eq("inspection_type", value: inspectionType.rawValue)
                .eq("status", value: InspectionStatus.in_progress.rawValue)
                .execute()
                .value

            if let existingInspection = existing.first {
                inspectionId = existingInspection.id
                print("[Inspection] Resumed existing inspection: \(existingInspection.id)")
                return
            }

            // Create new inspection record
            let newId = UUID().uuidString
            let now = ISO8601DateFormatter().string(from: Date())

            struct InsertPayload: Encodable {
                let id: String
                let tenant_id: String
                let order_id: String
                let driver_id: String
                let inspection_type: String
                let status: String
                let created_at: String
                let updated_at: String
            }

            let payload = InsertPayload(
                id: newId,
                tenant_id: order.tenantId,
                order_id: order.id,
                driver_id: driverId,
                inspection_type: inspectionType.rawValue,
                status: InspectionStatus.in_progress.rawValue,
                created_at: now,
                updated_at: now
            )

            try await supabase
                .from("vehicle_inspections")
                .insert(payload)
                .execute()

            inspectionId = newId
            print("[Inspection] Created new inspection: \(newId)")
        } catch {
            print("[Inspection] Failed to create/load inspection: \(error)")
            errorMessage = "Failed to start inspection. Please try again."
        }
    }
}

// MARK: - Local Data Types

/// Represents a locally captured photo before upload.
struct CapturedPhoto: Identifiable {
    let id: String
    let photoType: PhotoType
    let localPath: String
    let thumbnail: UIImage
    var uploadStatus: PhotoUploadStatus

    init(photoType: PhotoType, localPath: String, thumbnail: UIImage) {
        self.id = UUID().uuidString
        self.photoType = photoType
        self.localPath = localPath
        self.thumbnail = thumbnail
        self.uploadStatus = .pending
    }
}

/// Upload status for a captured photo.
enum PhotoUploadStatus {
    case pending
    case uploading
    case uploaded
    case failed
}

/// Represents a locally placed damage marker before persistence.
struct LocalDamage: Identifiable {
    let id: String
    var damageType: DamageType
    var view: String
    var xPosition: Double
    var yPosition: Double
    var description: String?

    init(damageType: DamageType, view: String, xPosition: Double, yPosition: Double, description: String? = nil) {
        self.id = UUID().uuidString
        self.damageType = damageType
        self.view = view
        self.xPosition = xPosition
        self.yPosition = yPosition
        self.description = description
    }
}
